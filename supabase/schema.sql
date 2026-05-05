-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Main cache table for storing T&C analysis results
CREATE TABLE IF NOT EXISTS public.tc_analyses (
  id              uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  domain          text    NOT NULL,
  url_hash        text    NOT NULL,
  risk_score      integer NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level      text    NOT NULL CHECK (risk_level IN ('safe', 'caution', 'danger')),
  clauses_checked integer DEFAULT 0,
  flags_found     integer DEFAULT 0,
  flags           jsonb   NOT NULL DEFAULT '[]'::jsonb,
  tc_url          text,
  jurisdiction    text    DEFAULT 'Unknown',
  created_at      timestamptz DEFAULT now(),
  expires_at      timestamptz DEFAULT (now() + interval '30 days'),

  CONSTRAINT tc_analyses_url_hash_key UNIQUE (url_hash)
);

-- Optimize analytics and frequent query lookups
CREATE INDEX IF NOT EXISTS idx_tc_analyses_domain     ON public.tc_analyses (domain);
CREATE INDEX IF NOT EXISTS idx_tc_analyses_url_hash   ON public.tc_analyses (url_hash);
CREATE INDEX IF NOT EXISTS idx_tc_analyses_expires_at ON public.tc_analyses (expires_at);
CREATE INDEX IF NOT EXISTS idx_tc_analyses_risk_level ON public.tc_analyses (risk_level);

-- Configure Row Level Security (RLS) for public access and caching updates
ALTER TABLE public.tc_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_valid_analyses"
  ON public.tc_analyses
  FOR SELECT
  USING (expires_at > now());

CREATE POLICY "insert_analyses"
  ON public.tc_analyses
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "update_analyses"
  ON public.tc_analyses
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Grant table-level access to API roles (RLS policies still enforce row-level rules)
GRANT SELECT, INSERT, UPDATE ON public.tc_analyses TO anon;
GRANT SELECT, INSERT, UPDATE ON public.tc_analyses TO authenticated;

-- Simplified analytic views for most analyzed and risk distribution stats
CREATE OR REPLACE VIEW public.popular_domains AS
  SELECT
    domain,
    COUNT(*) AS analysis_count,
    AVG(risk_score)::integer AS avg_risk_score,
    MAX(created_at) AS last_analysed
  FROM public.tc_analyses
  WHERE expires_at > now()
  GROUP BY domain
  ORDER BY analysis_count DESC;

CREATE OR REPLACE VIEW public.risk_distribution AS
  SELECT
    risk_level,
    COUNT(*) AS count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS percentage
  FROM public.tc_analyses
  WHERE expires_at > now()
  GROUP BY risk_level
  ORDER BY count DESC;
