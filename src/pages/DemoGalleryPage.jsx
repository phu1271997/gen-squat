import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GenSquatContext } from '../context/GenSquatContext';
import MapComponent from '../components/MapComponent';
import { Layers, MapPin, Search, PlusCircle, HelpCircle, Sparkles } from 'lucide-react';

export const DemoGalleryPage = () => {
  const { claims, faucet, getBalance, mode } = useContext(GenSquatContext);
  const navigate = useNavigate();
  const [faucetSuccess, setFaucetSuccess] = useState('');

  const handleFaucet = () => {
    const res = faucet();
    if (res.success) {
      setFaucetSuccess(`Claimed ${res.amount} GEN successfully!`);
      setTimeout(() => setFaucetSuccess(''), 3000);
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'SUBMITTED': return { bg: "rgba(245, 158, 11, 0.1)", text: "var(--color-warning)" };
      case 'ANALYZED': return { bg: "rgba(16, 185, 129, 0.1)", text: "var(--color-success)" };
      case 'DISPUTED': return { bg: "rgba(139, 92, 246, 0.1)", text: "var(--color-purple)" };
      case 'REFUNDED': return { bg: "rgba(255, 255, 255, 0.05)", text: "var(--color-text-muted)" };
      default: return { bg: "rgba(255,255,255,0.05)", text: "#fff" };
    }
  };

  return (
    <div style={{ animation: "fadeIn 0.4s ease-out" }}>
      {/* Gallery Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "32px" }}>
        <div style={{ textAlign: "left" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 800, margin: 0 }}>Forensic Claim Gallery</h2>
          <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: "4px 0 0 0" }}>
            Review seeded sample disputes and monitor active on-chain consensus cases.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {mode === 'DEMO' && (
            <button 
              className="btn-primary" 
              onClick={handleFaucet}
              style={{ background: "linear-gradient(135deg, var(--color-success) 0%, #059669 100%)", borderColor: "rgba(16,185,129,0.3)" }}
            >
              <Sparkles size={16} />
              Faucet (+10 GEN)
            </button>
          )}
          <button 
            className="btn-primary" 
            onClick={() => navigate('/submit')}
          >
            <PlusCircle size={16} />
            File New Claim
          </button>
        </div>
      </div>

      {faucetSuccess && (
        <div className="status-box success" style={{ marginBottom: "24px", animation: "slideIn 0.3s ease-out" }}>
          <p>{faucetSuccess} (New Balance: {getBalance().toFixed(2)} GEN)</p>
        </div>
      )}

      {/* Grid of Claims */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "24px" }}>
        {claims.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: "1/-1", padding: "40px", textAlign: "center" }}>
            <HelpCircle size={40} style={{ color: "var(--color-text-muted)", marginBottom: "12px" }} />
            <h4>No claims found</h4>
            <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Submit a new land parcel boundary to start.</p>
          </div>
        ) : (
          claims.map((claim) => {
            const statusStyle = getStatusBadgeStyle(claim.status);
            const isEncroaching = claim.ruling?.encroachment_detected || claim.dispute_ruling?.encroachment_detected;
            const centroidLat = (claim.polygon.reduce((sum, p) => sum + p[0], 0) / claim.polygon.length).toFixed(4);
            const centroidLng = (claim.polygon.reduce((sum, p) => sum + p[1], 0) / claim.polygon.length).toFixed(4);

            return (
              <div 
                key={claim.id} 
                className="glass-card claim-gallery-card"
                style={{ 
                  padding: "20px", 
                  textAlign: "left", 
                  display: "flex", 
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "transform 0.2s, border-color 0.2s",
                  border: isEncroaching ? "1px solid rgba(239, 68, 68, 0.25)" : "1px solid var(--border-glass)"
                }}
              >
                <div>
                  {/* Card Map Preview */}
                  <div style={{ pointerEvents: "none", marginBottom: "16px" }}>
                    <MapComponent 
                      polygon={claim.polygon}
                      isDrawing={false}
                      height="160px"
                    />
                  </div>

                  {/* Header Title */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                    <h4 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#fff" }}>
                      {claim.id.startsWith('demo_') 
                        ? (claim.id === 'demo_hcmc' ? 'District 2, HCMC' : claim.id === 'demo_hanoi' ? 'Hoan Kiem, Hanoi' : 'Dak Lak Farm')
                        : `Parcel ${claim.id}`}
                    </h4>
                    
                    <span style={{ 
                      fontSize: "10px", 
                      fontWeight: "bold", 
                      padding: "2px 8px", 
                      borderRadius: "8px", 
                      background: statusStyle.bg, 
                      color: statusStyle.text 
                    }}>
                      {claim.status}
                    </span>
                  </div>

                  {/* Centroid coordinates */}
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", color: "var(--color-text-muted)", fontSize: "11px", marginBottom: "12px" }}>
                    <MapPin size={12} />
                    <span>Centroid: {centroidLat}, {centroidLng}</span>
                  </div>

                  {/* Description snippet */}
                  <p style={{ 
                    fontSize: "12px", 
                    color: "var(--color-text-muted)", 
                    lineHeight: "1.4", 
                    margin: "0 0 16px 0",
                    height: "50px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical"
                  }}>
                    {claim.description}
                  </p>
                </div>

                {/* Bottom details & button */}
                <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "11px" }}>
                    {claim.ruling ? (
                      <span style={{ color: isEncroaching ? "var(--color-danger)" : "var(--color-success)", fontWeight: "bold" }}>
                        {isEncroaching ? "Encroachment Detected" : "No Encroachment"}
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>Consensus Pending</span>
                    )}
                  </div>

                  <button 
                    className="btn-search" 
                    onClick={() => navigate(`/claim/${claim.id}`)}
                    style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-glass)", color: "#fff", cursor: "pointer" }}
                  >
                    Inspect Details
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
export default DemoGalleryPage;
