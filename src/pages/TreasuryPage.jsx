import React, { useContext, useEffect, useState } from 'react';
import { GenSquatContext } from '../context/GenSquatContext';
import { 
  ShieldAlert, 
  RotateCw, 
  ArrowLeft, 
  CheckCircle, 
  HelpCircle,
  TrendingUp,
  Coins,
  Award,
  Wallet
} from 'lucide-react';

export const TreasuryPage = () => {
  const { 
    getTreasuryStats, 
    getUserReputation, 
    getWithdrawableBalance, 
    withdrawFunds, 
    getBalance,
    mode 
  } = useContext(GenSquatContext);

  const [stats, setStats] = useState({ surplus_pool: 0, total_locked: 0 });
  const [reputation, setReputation] = useState(100);
  const [withdrawable, setWithdrawable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [opsLoading, setOpsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [s, rep, bal] = await Promise.all([
        getTreasuryStats(),
        getUserReputation(),
        getWithdrawableBalance()
      ]);
      setStats(s);
      setReputation(rep);
      setWithdrawable(bal);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleWithdraw = async () => {
    if (withdrawable <= 0) return;
    setOpsLoading(true);
    setError('');
    setSuccess('');
    try {
      const amount = await withdrawFunds();
      setSuccess(mode === 'DEMO' 
        ? `Successfully pulled ${amount} GEN from Treasury to your wallet balance!`
        : `Successfully executed pull-payment withdrawal!`
      );
      await loadData();
    } catch (err) {
      setError(err.message || "Withdrawal transaction failed.");
    } finally {
      setOpsLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "300px" }}>
        <RotateCw className="spinner" size={32} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px", alignItems: "start", animation: "fadeIn 0.4s ease-out" }}>
      
      {/* Left Column: Financials & Withdrawals */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Success / Error alerts */}
        {success && <div className="status-box success" style={{ marginBottom: 0 }}><p>{success}</p></div>}
        {error && <div className="status-box error" style={{ marginBottom: 0 }}><p>{error}</p></div>}

        {/* Financial Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          
          <div className="glass-card" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", marginBottom: 0, textAlign: "left" }}>
            <div style={{ padding: "12px", borderRadius: "12px", background: "rgba(59, 130, 246, 0.1)", color: "var(--color-primary)" }}>
              <Coins size={24} />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--color-text-muted)", display: "block" }}>TOTAL LOCKED STAKES</span>
              <strong style={{ fontSize: "20px" }}>{stats.total_locked.toFixed(2)} GEN</strong>
            </div>
          </div>

          <div className="glass-card" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", marginBottom: 0, textAlign: "left" }}>
            <div style={{ padding: "12px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.1)", color: "var(--color-success)" }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--color-text-muted)", display: "block" }}>SURPLUS LIQUIDITY POOL</span>
              <strong style={{ fontSize: "20px" }}>{stats.surplus_pool.toFixed(2)} GEN</strong>
            </div>
          </div>

        </div>

        {/* Withdrawal Console */}
        <div className="glass-card" style={{ padding: "24px", textAlign: "left" }}>
          <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Wallet size={18} className="logo-icon" /> Pull-Payment Withdrawals
          </h3>
          
          <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "20px", lineHeight: "1.5" }}>
            GenSquat implements a secure pull-payment pattern. Instead of contracts pushing GEN to wallets automatically (which poses re-entrancy risks), eligible rewards and claim refunds are stored here. You must trigger a transaction to pull your balance.
          </p>

          <div style={{ background: "rgba(0,0,0,0.15)", padding: "20px", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>YOUR WITHDRAWABLE BALANCE</span>
              <h2 style={{ margin: "4px 0 0 0", fontSize: "28px", fontWeight: 800, color: withdrawable > 0 ? "var(--color-success)" : "#fff" }}>
                {withdrawable.toFixed(2)} GEN
              </h2>
            </div>
            
            <button 
              className="btn-primary" 
              onClick={handleWithdraw}
              disabled={withdrawable <= 0 || opsLoading}
              style={{ padding: "12px 24px", background: withdrawable > 0 ? "var(--color-success)" : "rgba(255,255,255,0.05)", borderColor: withdrawable > 0 ? "var(--color-success)" : "var(--border-glass)", color: withdrawable > 0 ? "#fff" : "var(--color-text-muted)" }}
            >
              {opsLoading ? <RotateCw className="spinner" size={16} /> : <Coins size={16} />}
              Withdraw GEN
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--color-text-muted)" }}>
            <span>Identity Wallet Balance: {getBalance().toFixed(2)} GEN</span>
            <span>Security Standard: Isolated Pull Pattern</span>
          </div>
        </div>

      </div>

      {/* Right Column: Reputation & Tokenomics overview */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Reputation Score */}
        <div className="glass-card" style={{ padding: "24px", textAlign: "left", background: "linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%)" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 600, color: "var(--color-purple)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Award size={18} /> Reputation Index
          </h3>
          
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "12px" }}>
            <strong style={{ fontSize: "36px", fontWeight: 800 }}>{reputation}</strong>
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Score Points</span>
          </div>

          <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: 0, lineHeight: "1.5" }}>
            Reputation points are tracked on-chain. Frivolous disputes or failed encroachment allegations degrade your Reputation Index. High indices offer future fee discounts.
          </p>
        </div>

        {/* Tokenomics Rules */}
        <div className="glass-card" style={{ padding: "24px", textAlign: "left" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 600 }}>GenSquat Tokenomics</h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ borderBottom: "1px solid var(--border-glass)", paddingBottom: "8px" }}>
              <h5 style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: "bold" }}>Claim Submission Lock: 5 GEN</h5>
              <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>Locked in treasury. Fully refunded if verdict is clean or encroachment is verified without appeals.</p>
            </div>
            
            <div style={{ borderBottom: "1px solid var(--border-glass)", paddingBottom: "8px" }}>
              <h5 style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: "bold" }}>Dispute Appeal Lock: 10 GEN</h5>
              <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>Required to challenge a verdict. Challenger wins back the 10 GEN + 2.5 GEN reward if overturned.</p>
            </div>

            <div style={{ paddingBottom: "4px" }}>
              <h5 style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: "bold" }}>Soulbound NFT Minting Fee: 2 GEN</h5>
              <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>Charged to record certified boundaries as soulbound NFTs. Minting fees are sent directly to the surplus pool.</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
export default TreasuryPage;
