import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { GenSquatContext } from '../context/GenSquatContext';
import { Layers, Shield, Play, HelpCircle, Users, Activity, ExternalLink } from 'lucide-react';

export const HomePage = () => {
  const { mode, setMode } = useContext(GenSquatContext);
  const navigate = useNavigate();

  const handleSelectMode = (selectedMode) => {
    setMode(selectedMode);
    if (selectedMode === 'DEMO') {
      navigate('/demo');
    } else {
      navigate('/submit');
    }
  };

  return (
    <div className="home-container" style={{ animation: "fadeIn 0.6s ease-out" }}>
      {/* Hero Section */}
      <section className="hero-section" style={{ textAlign: "center", padding: "60px 20px", background: "radial-gradient(circle at center, rgba(59, 130, 246, 0.08) 0%, transparent 70%)" }}>
        <div style={{ display: "inline-flex", padding: "16px", borderRadius: "24px", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)", marginBottom: "24px" }}>
          <Layers className="logo-icon animate-pulse" size={48} style={{ color: "var(--color-primary)" }} />
        </div>
        <h1 style={{ fontSize: "44px", fontWeight: 800, margin: "0 0 16px 0", background: "linear-gradient(135deg, #fff 40%, var(--color-primary) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          GenSquat v2
        </h1>
        <p style={{ fontSize: "18px", color: "var(--color-text-muted)", maxWidth: "700px", margin: "0 auto 32px auto", lineHeight: "1.6" }}>
          A decentralized spatial forensics application built on GenLayer. We leverage on-chain AI and multi-spectral satellite imagery to verify boundaries and resolve land encroachment disputes automatically.
        </p>

        {/* Mode Selector Cards */}
        <div className="mode-selector-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", maxWidth: "800px", margin: "0 auto 40px auto" }}>
          {/* Demo Mode Card */}
          <div 
            className="glass-card mode-card" 
            onClick={() => handleSelectMode('DEMO')}
            style={{ 
              cursor: "pointer", 
              border: mode === 'DEMO' ? "2px solid var(--color-primary)" : "1px solid var(--border-glass)",
              background: mode === 'DEMO' ? "rgba(59, 130, 246, 0.05)" : "var(--bg-card)",
              transition: "transform 0.2s, border-color 0.2s"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <Play className="logo-icon" size={24} style={{ color: "var(--color-success)" }} />
              <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.1)", color: "var(--color-success)" }}>
                RECOMMENDED FOR JUDGES
              </span>
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 8px 0" }}>Interactive Demo Mode</h3>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0, lineHeight: "1.5", textAlign: "left" }}>
              Run the full encroachment pipeline instantly. Includes pre-seeded historical disputes (HCMC, Hanoi, Dak Lak), mock satellite feeds, and an auto-faucet to test staking mechanics without localnet setup.
            </p>
          </div>

          {/* RPC Mode Card */}
          <div 
            className="glass-card mode-card" 
            onClick={() => handleSelectMode('RPC')}
            style={{ 
              cursor: "pointer", 
              border: mode === 'RPC' ? "2px solid var(--color-primary)" : "1px solid var(--border-glass)",
              background: mode === 'RPC' ? "rgba(59, 130, 246, 0.05)" : "var(--bg-card)",
              transition: "transform 0.2s, border-color 0.2s"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <Shield className="logo-icon" size={24} style={{ color: "var(--color-purple)" }} />
              <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "12px", background: "rgba(139, 92, 246, 0.1)", color: "var(--color-purple)" }}>
                STUDIO CONNECT
              </span>
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 8px 0" }}>GenLayer Studio / RPC Mode</h3>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0, lineHeight: "1.5", textAlign: "left" }}>
              Wire the frontend directly to your deployed GenLayer Intelligent Contracts on Studio Net or localnet. Uses the `genlayer-js` SDK to execute transactions and verify consensus state change.
            </p>
          </div>
        </div>

        <button 
          className="btn-primary" 
          onClick={() => navigate(mode === 'DEMO' ? '/demo' : '/submit')}
          style={{ padding: "12px 32px", fontSize: "15px" }}
        >
          Launch GenSquat App
        </button>
      </section>

      {/* How it works section */}
      <section className="info-section" style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "40px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "32px", textAlign: "center" }}>
          Engineered for Trustless Land Dispute Settlement
        </h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", textAlign: "left" }}>
          <div className="glass-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
              <Activity style={{ color: "var(--color-primary)" }} size={20} />
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>1. Multi-Spectral Time Series</h4>
            </div>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0, lineHeight: "1.5" }}>
              Our contracts automatically call the Microsoft Planetary Computer STAC API inside the consensus loop, fetching historical Sentinel-2 bands for the exact drawn polygon to review changes over the years.
            </p>
          </div>

          <div className="glass-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
              <Users style={{ color: "var(--color-success)" }} size={20} />
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>2. OpenStreetMap Registry</h4>
            </div>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0, lineHeight: "1.5" }}>
              We fetch OpenStreetMap attic registry data via the Overpass API to analyze boundary modifications, fencing modifications, and physical properties registered at various points in history.
            </p>
          </div>

          <div className="glass-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
              <Shield style={{ color: "var(--color-purple)" }} size={20} />
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>3. Democratic AI Consensus</h4>
            </div>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0, lineHeight: "1.5" }}>
              Instead of single-node LLMs, GenLayer's `prompt_comparative` enforces validator agreement. Multi-party nodes cross-analyze satellite layouts to return encroachment detections and confidence scores.
            </p>
          </div>
        </div>
      </section>

      {/* Footer Info */}
      <footer style={{ marginTop: "60px", padding: "24px 0", borderTop: "1px solid var(--border-glass)", textAlign: "center", fontSize: "12px", color: "var(--color-text-muted)" }}>
        <p>Built with GenLayer Intelligent Contracts & genlayer-js SDK.</p>
        <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "8px" }}>
          <a href="https://github.com/phu1271997/gen-squat" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
            GitHub Repository <ExternalLink size={12} />
          </a>
        </div>
      </footer>
    </div>
  );
};
export default HomePage;
