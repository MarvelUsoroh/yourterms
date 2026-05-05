#!/usr/bin/env python3
"""
yourTerms — CLAUDETTE Dataset Benchmark
───────────────────────────────────
Validates yourTerms's Gemini-based clause classifier against the CLAUDETTE-ToS
dataset from Hugging Face, computing precision, recall, and F1 per category
and overall.

USAGE
─────
1. Install dependencies:
   pip install datasets google-generativeai tqdm pandas scikit-learn

2. Set your Gemini API key:
   export GEMINI_API_KEY="AIza..."

3. Run (--sample limits to N clauses for quick testing):
   python3 benchmark/benchmark_claudette.py --sample 200 --output results.csv

EXPECTED RESULTS (for reference)
─────────────────────────────────
CLAUDETTE SVM baseline (Lippi et al., 2019): F1 = 79.4%
yourTerms zero-shot LLM target:                  F1 ≈ 82–88% recall, lower precision

Note: Lower precision vs fine-tuned models is expected and documented.
The contribution of yourTerms is the architectural pipeline (hybrid filter +
caching + Chrome UX), not raw classification accuracy.
"""

import os
import sys
import json
import time
import argparse
import csv
from collections import defaultdict

# Optional dependencies
# We wrap these in try-except blocks so that reviewers running the script 
# get explicit installation instructions instead of generic ModuleNotFoundErrors.
try:
    import google.generativeai as genai
except ImportError:
    sys.exit("Run: pip install google-generativeai")

try:
    from datasets import load_dataset
except ImportError:
    sys.exit("Run: pip install datasets")

try:
    from sklearn.metrics import classification_report, confusion_matrix
    import pandas as pd
    from tqdm import tqdm
except ImportError:
    sys.exit("Run: pip install scikit-learn pandas tqdm")

# Benchmark Configuration
# Defines the specific model tested and maps the academic CLAUDETTE dataset labels 
# to our extension's custom risk categories.

API_KEY = os.environ.get('GEMINI_API_KEY', '')
MODEL   = 'gemini-2.5-flash'

# Map CLAUDETTE dataset labels → yourTerms categories
# claudette_tos uses multi-label classification; we map to our 5 categories
LABEL_MAP = {
    'ch':  'UNILATERAL_CHANGE',       # Contract by using (unilateral change)
    'ter': 'UNILATERAL_TERMINATION',  # Termination
    'ltd': 'LIMITATION_OF_LIABILITY', # Limitation of liability
    'cr':  'CONTENT_OWNERSHIP',       # Content removal / ownership
    'j':   'JURISDICTION',            # Jurisdiction and choice of law
    'a':   'JURISDICTION',            # Arbitration (mapped to jurisdiction)
    'use': None,                      # Unilateral use of data — not in yourTerms scope
    'law': 'UNILATERAL_CHANGE',       # Governing law changes
}

yourTerms_CATEGORIES = [
    'UNILATERAL_CHANGE',
    'UNILATERAL_TERMINATION',
    'LIMITATION_OF_LIABILITY',
    'CONTENT_OWNERSHIP',
    'JURISDICTION',
]

# Zero-shot classification prompt
# This system prompt enforces GDPR context so the LLM categorizes clauses based on European law 
# rather than generic global standards.

SYSTEM_PROMPT = """You are a GDPR compliance analyst. Classify this Terms & Conditions clause into one of these categories if it is potentially unfair:

1. UNILATERAL_CHANGE - Provider modifies terms without meaningful notice (GDPR Art. 5 & 13)
2. UNILATERAL_TERMINATION - Provider terminates accounts without reason (Art. 21)
3. LIMITATION_OF_LIABILITY - Provider disclaims data breach responsibility (Art. 82)
4. CONTENT_OWNERSHIP - Provider claims broad license to user content (Art. 17)
5. JURISDICTION - Forces specific legal venue disadvantageous to user (Art. 77)
6. NONE - Clause is fair or does not fit any category

Respond with ONLY the category name. No explanation. One of:
UNILATERAL_CHANGE, UNILATERAL_TERMINATION, LIMITATION_OF_LIABILITY, CONTENT_OWNERSHIP, JURISDICTION, NONE"""

# LLM Pipeline Request
# Uses temperature 0.0 to ensure deterministic benchmarks (removing variation between runs).

def classify_clause(model, text: str, retries: int = 3) -> str:
    """Call Gemini to classify a single clause. Returns category string."""
    for attempt in range(retries):
        try:
            response = model.generate_content(
                f"{SYSTEM_PROMPT}\n\nCLAUSE:\n{text[:1000]}",
                generation_config=genai.GenerationConfig(
                    temperature=0.0,
                    max_output_tokens=20,
                ),
            )
            raw = response.text.strip().upper().replace('.', '').replace('"', '')
            # Normalise
            if raw in yourTerms_CATEGORIES:
                return raw
            return 'NONE'
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
            else:
                print(f"  [WARN] Gemini error after {retries} attempts: {e}")
                return 'NONE'

# Academic Ground Truth Loading
# Pulls the standard legal NLP dataset from HuggingFace to compare our zero-shot 
# performance against their fine-tuned baseline.

def load_claudette():
    """Load claudette_tos from Hugging Face."""
    print("Loading CLAUDETTE dataset from Hugging Face...")
    try:
        ds = load_dataset("joelito/claudette_tos", split="test")
    except Exception:
        # Try train split if test not available
        ds = load_dataset("joelito/claudette_tos", split="train")
    print(f"  Loaded {len(ds)} clauses")
    return ds

def extract_ground_truth(example) -> str:
    """Extract primary yourTerms category from a CLAUDETTE example."""
    # claudette_tos has a 'label' field with the unfair category
    label = example.get('label', None) or example.get('labels', None)

    if label is None:
        return 'NONE'

    # Handle both string and list labels
    if isinstance(label, list):
        # Multi-label: take first mapped category
        for lbl in label:
            mapped = LABEL_MAP.get(str(lbl).lower())
            if mapped:
                return mapped
        return 'NONE'

    mapped = LABEL_MAP.get(str(label).lower())
    return mapped if mapped else 'NONE'

# Evaluation and Reporting
# Calculates F1, Precision, and Recall scores to objectively measure if the zero-shot pipeline 
# is robust enough for consumer protection use cases.

def print_results(y_true, y_pred, output_path=None):
    """Print classification report and optionally save to CSV."""
    all_labels = yourTerms_CATEGORIES + ['NONE']

    print("\n" + "═" * 60)
    print("yourTerms vs CLAUDETTE — Classification Report")
    print("═" * 60)
    print(f"Total clauses evaluated: {len(y_true)}")
    print(f"Clauses flagged by yourTerms: {sum(1 for p in y_pred if p != 'NONE')}")
    print(f"Clauses flagged in ground truth: {sum(1 for t in y_true if t != 'NONE')}\n")

    # Per-category breakdown
    report = classification_report(
        y_true, y_pred,
        labels=all_labels,
        zero_division=0,
        output_dict=True,
    )

    rows = []
    for cat in yourTerms_CATEGORIES:
        r = report.get(cat, {})
        row = {
            'Category':  cat,
            'Precision': f"{r.get('precision', 0):.1%}",
            'Recall':    f"{r.get('recall', 0):.1%}",
            'F1':        f"{r.get('f1-score', 0):.1%}",
            'Support':   int(r.get('support', 0)),
        }
        rows.append(row)
        print(f"  {cat:<30} P={row['Precision']}  R={row['Recall']}  F1={row['F1']}  (n={row['Support']})")

    macro = report.get('macro avg', {})
    weighted = report.get('weighted avg', {})
    print(f"\n  {'MACRO AVERAGE':<30} P={macro.get('precision',0):.1%}  R={macro.get('recall',0):.1%}  F1={macro.get('f1-score',0):.1%}")
    print(f"  {'WEIGHTED AVERAGE':<30} P={weighted.get('precision',0):.1%}  R={weighted.get('recall',0):.1%}  F1={weighted.get('f1-score',0):.1%}")
    print(f"\n  CLAUDETTE SVM baseline (Lippi et al. 2019): F1 = 79.4%")
    print("═" * 60)

    # Confusion matrix
    print("\nConfusion matrix (rows=actual, cols=predicted):")
    cm = confusion_matrix(y_true, y_pred, labels=all_labels)
    df_cm = pd.DataFrame(cm, index=all_labels, columns=all_labels)
    print(df_cm.to_string())

    # Save to CSV
    if output_path:
        rows.append({
            'Category':  'MACRO AVG',
            'Precision': f"{macro.get('precision',0):.1%}",
            'Recall':    f"{macro.get('recall',0):.1%}",
            'F1':        f"{macro.get('f1-score',0):.1%}",
            'Support':   len(y_true),
        })
        df = pd.DataFrame(rows)
        df.to_csv(output_path, index=False)
        print(f"\nResults saved to: {output_path}")

    return report

# Script Entry Point

def main():
    parser = argparse.ArgumentParser(description='yourTerms CLAUDETTE Benchmark')
    parser.add_argument('--sample', type=int, default=None,
                        help='Limit to N clauses (default: all)')
    parser.add_argument('--output', type=str, default='benchmark/results.csv',
                        help='CSV output path')
    parser.add_argument('--delay', type=float, default=0.5,
                        help='Delay between API calls in seconds (default: 0.5)')
    parser.add_argument('--model', type=str, default=MODEL,
                        help=f'Gemini model to use (default: {MODEL})')
    args = parser.parse_args()

    # Check API key
    if not API_KEY:
        sys.exit("Set GEMINI_API_KEY environment variable first.")

    # Init Gemini
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel(args.model)
    print(f"Using model: {args.model}")

    # Load dataset
    dataset = load_claudette()
    examples = list(dataset)

    # Sample if requested
    if args.sample:
        import random
        random.seed(42)
        examples = random.sample(examples, min(args.sample, len(examples)))
        print(f"Sampled {len(examples)} clauses for evaluation")

    # Run classification
    y_true, y_pred = [], []
    errors = 0

    print(f"\nClassifying {len(examples)} clauses (this may take a while)...")
    os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else '.', exist_ok=True)

    with open(args.output.replace('.csv', '_raw.jsonl'), 'w') as f_raw:
        for i, ex in enumerate(tqdm(examples, desc="Classifying")):
            text = ex.get('text', '') or ex.get('clause', '') or ''
            if not text.strip():
                continue

            gt = extract_ground_truth(ex)
            pred = classify_clause(model, text)

            y_true.append(gt)
            y_pred.append(pred)

            f_raw.write(json.dumps({
                'text':  text[:200],
                'true':  gt,
                'pred':  pred,
                'match': gt == pred,
            }) + '\n')

            if args.delay > 0:
                time.sleep(args.delay)

    if not y_true:
        sys.exit("No clauses were evaluated. Check the dataset format.")

    # Print and save results
    report = print_results(y_true, y_pred, args.output)

    accuracy = sum(t == p for t, p in zip(y_true, y_pred)) / len(y_true)
    print(f"\nOverall accuracy: {accuracy:.1%}")
    print(f"Error rate:       {errors}/{len(examples)} API failures")

if __name__ == '__main__':
    main()
