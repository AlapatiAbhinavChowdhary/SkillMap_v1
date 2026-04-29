import { motion } from 'framer-motion';
import { Users, TrendingUp, Target, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useAppData, sanitizeTopSkills, useCountUp, formatNumber, chartPalette, staggerContainer, fadeItem } from '../utils';

export default function DashboardPage() {
  const { stats, clusters, loading } = useAppData();
  const total = stats?.total_resumes || 0;
  const clusterCount = stats?.clusters_found || clusters.length;
  const topSkills = sanitizeTopSkills(stats?.top_skill_domains || []).slice(0, 8);
  const maxCount = topSkills.length ? topSkills[0].count : 1;
  const distribution = stats?.cluster_distribution || [];
  const pieData = distribution.map((d, i) => ({ ...d, fill: chartPalette[i % chartPalette.length] }));

  return (
    <motion.div className="page-stack" variants={staggerContainer} initial="hidden" animate="show">
      {/* Hero */}
      <motion.div className="hero-centered" variants={fadeItem}>
        <h1>Talent Intelligence Hub</h1>
        <p>Map talent by skill signals using transformer embeddings and UMAP clustering.</p>
        <div className="hero-actions">
          <Link to="/analyze" className="button-primary">Quick Analyze →</Link>
          <Link to="/bulk" className="button-secondary">Batch Process</Link>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div className="stat-grid" variants={fadeItem}>
        <StatCard icon={Users} label="Resumes Analyzed" value={total} loading={loading} />
        <StatCard icon={TrendingUp} label="Skill Clusters" value={clusterCount} loading={loading} />
        <StatCard icon={Target} label="Skill Density" text="0.75" loading={loading} />
        <StatCard icon={HelpCircle} label="System Status" text="Healthy" loading={loading} />
      </motion.div>

      {/* Donut + Skill Signals */}
      <motion.div className="two-col-section" variants={fadeItem}>
        <div className="donut-card">
          <h3>Cluster Distribution</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="resume_count" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: '.75rem', color: '#6B6B6B' }}>Total</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{formatNumber(total)}</div>
            </div>
          </div>
        </div>

        <div className="signals-card">
          <h3>Top Skill Signals</h3>
          {topSkills.map((s) => {
            const pct = Math.round((s.count / maxCount) * 100);
            return (
              <div key={s.skill} className="signal-row">
                <span className="signal-name">{s.skill}</span>
                <span className="signal-pct">{pct}%</span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, text, loading }) {
  const countVal = useCountUp(value || 0);
  return (
    <motion.div className="stat-card" whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className="stat-value">
          {loading ? <span className="shimmer-line" /> : text ? text : countVal}
        </div>
      </div>
      <div className="stat-icon-wrap"><Icon size={20} /></div>
    </motion.div>
  );
}
