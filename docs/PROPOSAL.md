# **Project Proposal**

## **Cover Sheet**

| **Project Title** | **Automated Legal Transparency Agent (yourTerms): An Agentic Framework for Real-Time GDPR Compliance** |
| :--- | :--- |
| **Learner Name** | [Your Name] |
| **Student ID** | [Student ID] |
| **Email** | [Email Address] |
| **Stream** | [Your Stream/Course] |
| **Date** | [Current Date] |
| **Supervisor** | [Supervisor Name] |
| **Signature** | _________________________ |

---

## **1. Introduction and Personal Motivation**

The inspiration for this project is deeply rooted in a realization about the digital divide and trust. In October 2024, I attended a session organized by *ThriveInclusion* themed "Financial Inclusion," where we discussed the critical need for financial education in developing regions, particularly the Global South. A recurring theme was the role of technology in solving these problems—and crucially, why people unfamiliar with these new frontiers should trust them.

This conversation illuminated a stark reality: in our quest for digital convenience, we have unknowingly traded away our privacy. As the saying goes, *"if you are not the customer, then you are the product."* Yet, despite this cynicism, millions of users continue to agree to Terms and Conditions (T&C) they never read—a phenomenon confirmed by a 2017 Deloitte study finding that **91% of consumers accept legal terms without reading them** (Cakebread, 2017). They don't ignore these documents out of negligence, but out of necessity; the texts are notoriously ambiguous, lengthy, and written in "jargon" that walls off the average mind from understanding their rights.

This friction leads to the "Privacy Paradox"—we care about our data, but we sign it away because reading the policies is practically impossible.

During the *ThriveInclusion* session, a pivotal question was asked: *"Why can't we create a way to help people understand what rights they are giving away and to where?"*

This project, **yourTerms (Automated Legal Transparency Agent)**, is my answer to that question. It is a vision for a system that doesn't just "summarize" text, but actively empowers users. By analyzing terms to highlight red flags, fine print, and data rights, yourTerms aims to restore the balance of power, enabling users to make truly informed choices before they click "I Agree."

---

## **2. Personal Learning Objectives**

My motivation for this project extends beyond academic requirements; it is about building technology that serves a social good. Technically and professionally, I aim to:

1.  **Bridge the Trust Gap with AI:** I want to move beyond simple automation to create "Agentic AI"—software that acts as a fiduciary for the user, navigating the web (RPA) to protect their interests without needing constant supervision.
2.  **Democratize Legal Understanding:** By working with **System Prompt Engineering** and NLP, I will learn how to translate "Lawyer Talk" into human language, making legal transparency accessible to everyone, not just those who can afford counsel.
3.  **Build Full-Stack Resilience:** This project challenges me to integrate complex, asynchronous Python scrapers with a reactive Next.js frontend, simulating the architecture of a modern, scalable SaaS product.
4.  **Enforce Ethics through Code:** I want to understand how software can actively enforce GDPR (Articles 12, 13, 14), turning abstract legal rights into concrete code functionality.

---

## **3. Project Scope and Objectives**

### **3.1 Evolution of the Solution**
While tools like *Terms of Service; Didn't Read (ToS;DR)* pioneered the field of contract simplification, they rely on manual crowdsourcing, which inevitably limits their speed and coverage. Similarly, earlier automated tools like *uTerms* used dictionary-based keyword matching, which can be bypassed by creative legal wording.

**yourTerms improves upon these solutions by introducing:**
*   **Scalability:** Unlike manual reviews, yourTerms uses **Agentic RPA** to retrieve and analyze contracts in real-time, allowing it to cover millions of apps instantly.
*   **Semantic Understanding:** By using **Large Language Models (LLMs)**, yourTerms understands the *meaning* of a clause (e.g., "we reserve the right to modify") rather than just matching keywords, ensuring higher accuracy even with complex "legalese."
*   **Interactivity:** Unlike static summaries, yourTerms features a **Chat UI**, transforming the T&C from a lecture into a conversation where users can ask specific questions.

### **3.2 Objectives**
The core objective is to build an automated agent that restores "Informed Consent" through:
*   **Automated Retrieval:** eliminating user friction (copy-pasting).
*   **GDPR-Aligned Analysis:** detecting specific unfair terms.
*   **Interactive Chat:** allowing for Q&A via RAG (Retrieval Augmented Generation).

### **3.3 In-Scope Features**
*   **RPA Scraper:** A Playwright-based Python agent.
*   **Risk Analysis Engine:** An LLM pipeline scoring contracts on 5 unfair categories.
*   **Traffic Light Dashboard:** A React UI showing risk levels.
*   **Chat Interface:** An interactive Q&A bot.

### **3.4 Out-of-Scope**
*   **Login-walled pages:** Public T&Cs only.
*   **Legal Advice:** Informational use only.
*   **Multilingual Support:** English only for the prototype.

---

## **4. Technical Specification**

### **4.1 The "Retriever" (RPA Module)**
*   **Tool:** **Playwright** (Python). Chosen for its ability to handle modern Single Page Applications (SPAs) and dynamic content better than Selenium.

### **4.2 The "Analyzer" (LLM Module)**
*   **Model Selection Strategy:** While the prototype will start with **OpenAI GPT-4o** for its high reasoning baseline, we will explicitly benchmark it against high-performance open-source models like **DeepSeek-V3** and **Llama 3**.
    *   *Why?* Open-source models offer data privacy benefits (processing legal text locally) and cost reduction. The project will evaluate which model offers the best balance of legal accuracy and operational cost.
*   **Logic:** The system acts as a "Privacy Officer," validating text against **Luzak & Loos (2016)** categories and **GDPR Principles**.

#### **GDPR Mapping of Analysis Categories**
The system checks for 5 specific "Red Flags," each grounded in GDPR rights:
1.  **Unilateral Change:** "We change terms without notice."
    *   *GDPR Violation:* Undermines **Article 13 (Transparency)** and **Article 5 (Fairness)**; users cannot consent to changes they aren't aware of.
2.  **Unilateral Termination:** "We ban you without reason."
    *   *GDPR Violation:* Conflicts with **Article 21 (Right to Object)** and fairness principles regarding service access.
3.  **Limitation of Liability:** "We are not responsible for data loss."
    *   *GDPR Violation:* Potentially conflicts with **Article 82 (Right to Compensation)** for data breaches.
4.  **Content Ownership:** "We own your uploaded photos."
    *   *GDPR Violation:* Conflicts with **Article 17 (Right to Erasure/Right to be Forgotten)**; if they own it, can you truly delete it?
5.  **Jurisdiction:** "You must sue us in California."
    *   *GDPR Violation:* Impedes **Article 77 (Right to lodge a complaint)** with a local supervisory authority.

### **4.3 The "Frontend" (User Interface)**
*   **Framework:** **Next.js** (React) with Tailwind CSS.
*   **Features:** URL Input, Risk Dashboard (0-100 Score), and RAG-powered Chat Window.

---

## **5. Equipment and Critical Resources**

*   **Hardware:** Development Laptop (Windows OS).
*   **Software:** VS Code, Docker.
*   **API Services:** OpenAI API, DeepSeek API (for benchmarking).
*   **Data:** CLAUDETTE Dataset (Lippi et al., 2019) for validation.

---

## **6. Project Plan (Weekly Schedule)**

| **Week** | **Phase** | **Milestones & Activities** |
| :--- | :--- | :--- |
| **1-2** | **Inception** | • Finalize Proposal & Literature Review.<br>• Set up GitHub repo.<br>• Research Playwright vs. Selenium. |
| **3** | **RPA Dev** | • Build basic `scraper.py`.<br>• Implement link detection heuristics. |
| **4** | **RPA Testing** | • Test scraper on 10 major sites.<br>• Handle errors/timeouts. |
| **5** | **Model Benchmarking** | • **[New]** benchmark GPT-4o vs DeepSeek/Llama 3 on legal text samples.<br>• Select final model based on accuracy/cost. |
| **6** | **LLM Logic** | • Design System Prompts.<br>• Implement GDPR mapping logic. |
| **7** | **Backend Integration** | • Connect RPA output to LLM input (FastAPI). |
| **8** | **Frontend Dev** | • Build Next.js Dashboard & Traffic Light UI. |
| **9** | **Chat UI Feature** | • Implement RAG-based Chat interface for Q&A. |
| **10** | **Testing** | • Evaluate against CLAUDETTE dataset.<br>• User Acceptance Testing. |
| **11** | **Refinement** | • Bug fixes & UI Polish. |
| **12** | **Submission** | • Final Report & Presentation. |

---

## **7. References**

*   Cakebread, C. (2017). You’re not alone, no one reads terms of service agreements. [online] Business Insider. Available at: https://www.businessinsider.com/deloitte-study-91-percent-agree-terms-of-service-without-reading-2017-11..
*   European Union (2016). Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC (General Data Protection Regulation). [online] Europa.eu. Available at: https://eur-lex.europa.eu/eli/reg/2016/679/oj.
*   Lippi, M., Pałka, P., Contissa, G., Lagioia, F., Micklitz, H.-W., Sartor, G. and Torroni, P. (2019). CLAUDETTE: an automated detector of potentially unfair clauses in online terms of service. Artificial Intelligence and Law, 27(2), pp.117–139. doi:https://doi.org/10.1007/s10506-019-09243-2.
*   Loos, M. and Luzak, J. (2015). Wanted: A Bigger Stick. On Unfair Terms in Consumer Contracts with Online Service Providers. SSRN Electronic Journal. doi:https://doi.org/10.2139/ssrn.2546859.
*   Mcdonald, A. and Cranor, L. (2001). The Cost of Reading Privacy Policies. [online] p.183. Available at: https://lorrie.cranor.org/pubs/readingPolicyCost-authorDraft.pdf.
*   Micklitz, Hans-W., Panagis, Y. and Pałka, P. (2017). uTerms: a software to highlight potentially unfair terms of service. [online] uTerms. Available at: http://uterms.software/.
