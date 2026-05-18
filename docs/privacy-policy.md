# Privacy Policy — yourTerms

**Effective date:** 18 May 2025  
**Last updated:** 18 May 2025  
**Extension:** yourTerms — Legal Transparency Agent  
**Developer:** Marvel Usoroh

---

## Overview

yourTerms is a Chrome browser extension that reads the Terms & Conditions or Privacy Policy of websites you visit and analyses them for potentially unfair or harmful clauses. This policy explains what data is used, where it goes, and what we do (and do not) do with it.

---

## 1. What data does yourTerms access?

When you click the yourTerms icon or trigger an analysis, the extension reads the **visible text content of the current page** — specifically the Terms & Conditions or Privacy Policy text displayed in your browser tab.

**yourTerms does not access:**
- Your browsing history
- Your cookies or session data
- Your login credentials or account information
- Any other pages or tabs you have open
- Your device files or local data (other than the extension's own cache, described below)

---

## 2. What is sent to external servers?

The extracted page text is sent to a **secure API endpoint** (hosted on [Supabase](https://supabase.com)) for AI-powered analysis. That API forwards the text to an AI language model (currently [DeepSeek](https://deepseek.com)) to classify clauses for GDPR compliance risks.

**Summary of data flow:**

```
Page text on your screen
        ↓
yourTerms extension (your browser)
        ↓
Supabase Edge Function (EU/US cloud, encrypted in transit via HTTPS)
        ↓
DeepSeek AI API (analysis only — no storage)
        ↓
Risk flags returned to your browser
```

**What is NOT transmitted:**
- Your IP address is not logged by us
- Your identity or account details are never sent
- No browsing history or cross-site data is collected

---

## 3. Is any data stored?

**Locally (on your device):**  
yourTerms caches analysis results in your browser's local storage (`chrome.storage.local`) so that repeat visits to the same Terms & Conditions page do not require a new API call. This cache is stored only on your device and is never transmitted to us.

**Remotely:**  
Analysis results may be temporarily cached in Supabase for performance purposes (to serve frequently-analysed pages faster). Cached results contain only the **analysis output** (risk flags), not the original page text or any user-identifying information. Cache entries expire after 30 days.

We do **not** maintain user accounts, user profiles, or any database of individual users.

---

## 4. Does yourTerms sell or share my data?

**No.** We do not sell, rent, trade, or share your data with any third party for marketing, advertising, or commercial purposes.

The only third-party services used are:
- **Supabase** — secure cloud infrastructure for the analysis API. [Supabase Privacy Policy](https://supabase.com/privacy)
- **DeepSeek** — AI language model used to classify clauses. [DeepSeek Privacy Policy](https://www.deepseek.com/en/privacy)

Both services are used solely to perform the analysis you requested and are not permitted to use your data for any other purpose.

---

## 5. Why does the extension request access to all websites?

yourTerms requests `<all_urls>` host permission because Terms & Conditions pages exist on virtually every website on the internet. The extension cannot know in advance which domain will host a T&C page.

This permission is used **only** to read the text content of the page you are currently viewing when you actively click the yourTerms icon. It is never used to monitor your browsing passively, run in the background across tabs, or collect data from sites you haven't explicitly triggered.

---

## 6. GDPR rights (for EU/EEA users)

Because yourTerms does not collect personal data or maintain user accounts, most GDPR rights (access, rectification, deletion) are not applicable in the traditional sense — there is no profile to access or delete.

If you have concerns, you can:
- **Remove local cache:** Click the extension icon → Settings and clear cached results, or remove the extension entirely (this clears all local storage)
- **Contact us:** See Section 8 below

---

## 7. Children's privacy

yourTerms is not directed at children under 13 (or under 16 in the EU). We do not knowingly collect data from minors.

---

## 8. Contact

If you have questions about this privacy policy or how your data is handled, please open an issue at:

**GitHub:** [https://github.com/MarvelUsoroh/yourterms](https://github.com/MarvelUsoroh/yourterms)

---

## 9. Changes to this policy

If this policy changes materially, we will update the **"Last updated"** date above and, where appropriate, note the change in the Chrome Web Store listing. Continued use of the extension after a policy update constitutes acceptance of the revised policy.

---

*yourTerms is built to protect you — not to profit from your data.*
