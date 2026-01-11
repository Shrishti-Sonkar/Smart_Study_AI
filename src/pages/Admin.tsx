import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, TrendingDown, Database, Zap, Brain, Sparkles, Shield, Users, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAggregatedStats, useAnalytics } from '@/hooks/useAnalytics';
import { useTrustScoreStats, useHumanFeedbackStats } from '@/hooks/useTrustAnalytics';
import { useQueryHistory } from '@/hooks/useQueryHistory';
import { HallucinationBadge } from '@/components/HallucinationBadge';
import { ModelBadge } from '@/components/ModelBadge';
import { RiskBadge } from '@/components/RiskBadge';
import { TrustScoreGauge } from '@/components/TrustScoreGauge';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid, Legend } from 'recharts';

const COLORS = ['hsl(270, 80%, 55%)', 'hsl(220, 90%, 55%)', 'hsl(175, 70%, 45%)'];
const RISK_COLORS = {
  low: 'hsl(145, 65%, 42%)',
  medium: 'hsl(45, 95%, 55%)',
  high: 'hsl(0, 75%, 55%)'
};

const Admin = () => {
  const { stats, isLoading: statsLoading } = useAggregatedStats();
  const { data: history, isLoading: historyLoading } = useQueryHistory(50);
  const { data: trustStats } = useTrustScoreStats();
  const { data: feedbackStats } = useHumanFeedbackStats();

  const modelData = stats ? [
    { name: 'LLM-1 (Fast)', value: stats.modelDistribution.llm1 },
    { name: 'LLM-2 (Concept)', value: stats.modelDistribution.llm2 },
    { name: 'LLM-3 (Deep)', value: stats.modelDistribution.llm3 },
  ] : [];

  const riskData = trustStats ? [
    { name: 'Low Risk', value: trustStats.riskDistribution.low, fill: RISK_COLORS.low },
    { name: 'Medium Risk', value: trustStats.riskDistribution.medium, fill: RISK_COLORS.medium },
    { name: 'High Risk', value: trustStats.riskDistribution.high, fill: RISK_COLORS.high },
  ] : [];

  const feedbackByRiskData = feedbackStats ? [
    { 
      risk: 'Low Risk', 
      approvals: feedbackStats.feedbackByRisk.low.approvals, 
      overrides: feedbackStats.feedbackByRisk.low.overrides 
    },
    { 
      risk: 'Medium Risk', 
      approvals: feedbackStats.feedbackByRisk.medium.approvals, 
      overrides: feedbackStats.feedbackByRisk.medium.overrides 
    },
    { 
      risk: 'High Risk', 
      approvals: feedbackStats.feedbackByRisk.high.approvals, 
      overrides: feedbackStats.feedbackByRisk.high.overrides 
    },
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm"><ArrowLeft size={16} className="mr-2" />Back</Button>
            </Link>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Analytics Dashboard</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="general" className="gap-2">
              <BarChart3 size={16} />
              General Analytics
            </TabsTrigger>
            <TabsTrigger value="trust" className="gap-2">
              <Shield size={16} />
              Trust & Feedback
            </TabsTrigger>
          </TabsList>

          {/* General Analytics Tab */}
          <TabsContent value="general" className="space-y-6">
            {/* Stats cards */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Queries</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">{stats?.totalQueries || 0}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Database size={14} />Cache Hit Rate</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold text-accent">{stats?.cacheHitRate.toFixed(1) || 0}%</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Hallucination</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">{(stats?.avgHallucinationScore || 0).toFixed(2)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><TrendingDown size={14} />Avg Cost Saved</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold text-success">{stats?.avgCostSaved.toFixed(0) || 0}%</p></CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Model Usage Distribution</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={modelData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                        {modelData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-lg">Model Legend</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3"><Zap className="text-llm1" /><div><p className="font-medium">LLM-1: Fast Recall</p><p className="text-sm text-muted-foreground">Gemini Flash Lite</p></div></div>
                  <div className="flex items-center gap-3"><Brain className="text-llm2" /><div><p className="font-medium">LLM-2: Concept Understanding</p><p className="text-sm text-muted-foreground">Groq Llama 3.1</p></div></div>
                  <div className="flex items-center gap-3"><Sparkles className="text-llm3" /><div><p className="font-medium">LLM-3: Deep Reasoning</p><p className="text-sm text-muted-foreground">Gemini Pro</p></div></div>
                </CardContent>
              </Card>
            </div>

            {/* Query logs */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Recent Queries</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b"><th className="text-left py-2 px-2">Question</th><th className="text-left py-2 px-2">Model</th><th className="text-left py-2 px-2">Hallucination</th><th className="text-left py-2 px-2">Cache</th><th className="text-left py-2 px-2">Saved</th></tr></thead>
                    <tbody>
                      {history?.slice(0, 10).map((q) => (
                        <tr key={q.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-2 max-w-xs truncate">{q.question}</td>
                          <td className="py-2 px-2"><ModelBadge tier={q.model_tier} name={q.model_used} size="sm" /></td>
                          <td className="py-2 px-2"><HallucinationBadge score={Number(q.hallucination_score)} size="sm" showLabel={false} /></td>
                          <td className="py-2 px-2">{q.cache_hit ? '⚡' : '—'}</td>
                          <td className="py-2 px-2 text-success font-medium">{q.cost_saved_percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trust & Feedback Tab */}
          <TabsContent value="trust" className="space-y-6">
            {/* Trust Stats Cards */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="flex flex-col items-center justify-center p-4">
                <TrustScoreGauge score={trustStats?.avgTrustScore || 0} size="lg" />
                <p className="text-sm text-muted-foreground mt-2">Average Trust Score</p>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Users size={14} />Total Feedback</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">{feedbackStats?.totalFeedback || 0}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle size={14} className="text-success" />Approvals</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-success">{feedbackStats?.approvals || 0}</p>
                  <p className="text-sm text-muted-foreground">{feedbackStats?.approvalRate.toFixed(1) || 0}% approval rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><XCircle size={14} className="text-destructive" />Overrides</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold text-destructive">{feedbackStats?.overrides || 0}</p></CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Trust Score Trend */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Trust Score Trend (Last 14 Days)</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trustStats?.trustScoreTrend || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10 }} 
                        tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip 
                        formatter={(value: number) => [`${value}`, 'Avg Trust Score']}
                        labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="avgTrustScore" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Risk Distribution */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Risk Level Distribution</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={riskData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={60} 
                        outerRadius={80} 
                        paddingAngle={5} 
                        dataKey="value" 
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {riskData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Feedback by Risk Level */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Human Feedback by Risk Level</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={feedbackByRiskData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="risk" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="approvals" name="Approvals" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="overrides" name="Overrides" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Human Feedback */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Recent Human Feedback</CardTitle></CardHeader>
              <CardContent>
                {feedbackStats?.recentFeedback && feedbackStats.recentFeedback.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Question</th>
                          <th className="text-left py-2 px-2">Trust Score</th>
                          <th className="text-left py-2 px-2">Risk Level</th>
                          <th className="text-left py-2 px-2">Decision</th>
                          <th className="text-left py-2 px-2">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feedbackStats.recentFeedback.map((f) => (
                          <tr key={f.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 px-2 max-w-xs truncate">{f.question}</td>
                            <td className="py-2 px-2 font-medium">{Number(f.trust_score).toFixed(0)}</td>
                            <td className="py-2 px-2">
                              <RiskBadge level={f.risk_level as 'low' | 'medium' | 'high'} size="sm" />
                            </td>
                            <td className="py-2 px-2">
                              {f.decision === 'approve' ? (
                                <span className="inline-flex items-center gap-1 text-success">
                                  <CheckCircle size={14} /> Approved
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-destructive">
                                  <XCircle size={14} /> Override
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-muted-foreground">
                              {new Date(f.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No human feedback recorded yet.</p>
                    <p className="text-sm mt-1">Use the Approve/Override buttons on answers to provide feedback.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
