import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TrustScoreStats {
  avgTrustScore: number;
  avgConfidence: number;
  avgContextCompleteness: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  trustScoreTrend: Array<{
    date: string;
    avgTrustScore: number;
    count: number;
  }>;
}

export interface HumanFeedbackStats {
  totalFeedback: number;
  approvals: number;
  overrides: number;
  approvalRate: number;
  feedbackByRisk: {
    low: { approvals: number; overrides: number };
    medium: { approvals: number; overrides: number };
    high: { approvals: number; overrides: number };
  };
  recentFeedback: Array<{
    id: string;
    question: string;
    trust_score: number;
    risk_level: string;
    decision: string;
    created_at: string;
  }>;
}

export function useTrustScoreStats() {
  return useQuery({
    queryKey: ['trust-score-stats'],
    queryFn: async () => {
      // Fetch query logs with trust scores
      const { data: logs, error } = await supabase
        .from('query_logs')
        .select('trust_score, risk_level, confidence_score, context_completeness_score, created_at')
        .not('trust_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!logs || logs.length === 0) {
        return {
          avgTrustScore: 0,
          avgConfidence: 0,
          avgContextCompleteness: 0,
          riskDistribution: { low: 0, medium: 0, high: 0 },
          trustScoreTrend: []
        } as TrustScoreStats;
      }

      // Calculate averages
      const avgTrustScore = logs.reduce((sum, l) => sum + Number(l.trust_score || 0), 0) / logs.length;
      const avgConfidence = logs.reduce((sum, l) => sum + Number(l.confidence_score || 0), 0) / logs.length;
      const avgContextCompleteness = logs.reduce((sum, l) => sum + Number(l.context_completeness_score || 0), 0) / logs.length;

      // Risk distribution
      const riskDistribution = logs.reduce((acc, l) => {
        const risk = l.risk_level as 'low' | 'medium' | 'high';
        if (risk) acc[risk] = (acc[risk] || 0) + 1;
        return acc;
      }, { low: 0, medium: 0, high: 0 });

      // Trust score trend by date
      const trendMap = new Map<string, { total: number; count: number }>();
      logs.forEach(l => {
        const date = new Date(l.created_at).toISOString().split('T')[0];
        const existing = trendMap.get(date) || { total: 0, count: 0 };
        trendMap.set(date, {
          total: existing.total + Number(l.trust_score || 0),
          count: existing.count + 1
        });
      });

      const trustScoreTrend = Array.from(trendMap.entries())
        .map(([date, data]) => ({
          date,
          avgTrustScore: Math.round(data.total / data.count),
          count: data.count
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14); // Last 14 days

      return {
        avgTrustScore,
        avgConfidence,
        avgContextCompleteness,
        riskDistribution,
        trustScoreTrend
      } as TrustScoreStats;
    },
    refetchInterval: 10000
  });
}

export function useHumanFeedbackStats() {
  return useQuery({
    queryKey: ['human-feedback-stats'],
    queryFn: async () => {
      const { data: feedback, error } = await supabase
        .from('human_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!feedback || feedback.length === 0) {
        return {
          totalFeedback: 0,
          approvals: 0,
          overrides: 0,
          approvalRate: 0,
          feedbackByRisk: {
            low: { approvals: 0, overrides: 0 },
            medium: { approvals: 0, overrides: 0 },
            high: { approvals: 0, overrides: 0 }
          },
          recentFeedback: []
        } as HumanFeedbackStats;
      }

      const approvals = feedback.filter(f => f.decision === 'approve').length;
      const overrides = feedback.filter(f => f.decision === 'override').length;

      // Feedback by risk level
      const feedbackByRisk = {
        low: { approvals: 0, overrides: 0 },
        medium: { approvals: 0, overrides: 0 },
        high: { approvals: 0, overrides: 0 }
      };

      feedback.forEach(f => {
        const risk = f.risk_level as 'low' | 'medium' | 'high';
        if (risk && feedbackByRisk[risk]) {
          if (f.decision === 'approve') {
            feedbackByRisk[risk].approvals++;
          } else {
            feedbackByRisk[risk].overrides++;
          }
        }
      });

      return {
        totalFeedback: feedback.length,
        approvals,
        overrides,
        approvalRate: approvals / Math.max(feedback.length, 1) * 100,
        feedbackByRisk,
        recentFeedback: feedback.slice(0, 10)
      } as HumanFeedbackStats;
    },
    refetchInterval: 10000
  });
}
