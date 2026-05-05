// lib/supabase-client.js
// simple fetch client to get and save data from supabase
export class SupabaseClient {
  constructor(url, anonKey) {
    this.url = url.replace(/\/$/, '');
    this.anonKey = anonKey;
    this.headers = {
      'apikey': anonKey,
      'Content-Type': 'application/json',
    };
  }

  /**
   * get cached data by url hash
   *
   * @param {string} urlHash
   * @returns {Promise<object|null>}
   */
  async getAnalysis(urlHash) {
    const now = new Date().toISOString();
    const endpoint = `${this.url}/rest/v1/tc_analyses`
      + `?url_hash=eq.${encodeURIComponent(urlHash)}`
      + `&expires_at=gt.${now}`
      + `&limit=1`
      + `&select=*`;

    try {
      const res = await fetch(endpoint, { headers: this.headers });
      if (!res.ok) return null;
      const rows = await res.json();
      return rows[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * get data using the domain name
   *
   * @param {string} domain
   * @returns {Promise<object|null>}
   */
  async getAnalysisByDomain(domain) {
    const now = new Date().toISOString();
    const endpoint = `${this.url}/rest/v1/tc_analyses`
      + `?domain=eq.${encodeURIComponent(domain)}`
      + `&expires_at=gt.${now}`
      + `&order=created_at.desc`
      + `&limit=1`
      + `&select=*`;

    try {
      const res = await fetch(endpoint, { headers: this.headers });
      if (!res.ok) return null;
      const rows = await res.json();
      return rows[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * save analysis to db
   *
   * @param {object} record
   * @returns {Promise<boolean>}
   */
  async saveAnalysis(record) {
    try {
      const res = await fetch(`${this.url}/rest/v1/tc_analyses?on_conflict=url_hash`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(record),
      });
      return res.ok || res.status === 409;
    } catch {
      return false;
    }
  }

    async isConnected() {
    try {
      const res = await fetch(`${this.url}/rest/v1/tc_analyses?limit=0`, {
        headers: this.headers,
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
