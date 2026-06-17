import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { GenSquatContext } from '../context/GenSquatContext';
import MapComponent from '../components/MapComponent';
import { 
  RotateCw, 
  MapPin, 
  Layers, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowLeft, 
  Cpu, 
  Award, 
  Calendar, 
  ChevronRight,
  TrendingDown,
  Info
} from 'lucide-react';

export const ClaimDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getClaimDetails, analyzeClaim, claimRefund, mintNft } = useContext(GenSquatContext);

  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [progress, setProgress] = useState('');
  const [opsLoading, setOpsLoading] = useState(false);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const details = await getClaimDetails(id);
      setClaim(details);
    } catch (e) {
      setError(e.message || "Failed to load claim details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [id]);

  const handleStartAnalysis = async () => {
    setOpsLoading(true);
    setError('');
    setSuccess('');
    try {
      await analyzeClaim(id, (p) => setProgress(p));
      setSuccess("Democratic AI Consensus finished forensic analysis!");
      setProgress('');
      await loadDetails();
    } catch (err) {
      setError(err.message || "Analysis execution failed.");
      setProgress('');
    } finally {
      setOpsLoading(false);
    }
  };

  const handleClaimRefund = async () => {
    setOpsLoading(true);
    setError('');
    setSuccess('');
    try {
      await claimRefund(id);
      setSuccess("Refund successfully processed. Stake balance unlocked in Treasury!");
      await loadDetails();
    } catch (err) {
      setError(err.message || "Refund processing failed.");
    } finally {
      setOpsLoading(false);
    }
  };

  const handleMintSbt = async () => {
    setOpsLoading(true);
    setError('');
    setSuccess('');
    try {
      const tokenId = await mintNft(id);
      setSuccess(`Soulbound boundary proof NFT minted successfully! Token ID: ${tokenId}`);
      await loadDetails();
    } catch (err) {
      setError(err.message || "Minting failed. Make sure you paid the 2 GEN fee.");
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

  if (error && !claim) {
    return (
      <div className="status-box error" style={{ maxWidth: "600px", margin: "40px auto" }}>
        <AlertTriangle size={24} />
        <div className="status-content">
          <h4>Lookup Failed</h4>
          <p>{error}</p>
          <Link to="/submit" style={{ color: "var(--color-primary)", textDecoration: "none", marginTop: "12px", display: "inline-block" }}>
            Return to Submit Claim
          </Link>
        </div>
      </div>
    );
  }

  // Shift coordinates slightly to represent neighbor shifted encroachment border visually
  const getEncroachmentPolygon = () => {
    if (!claim || !claim.polygon) return null;
    const isEncroaching = claim.ruling?.encroachment_detected || claim.dispute_ruling?.encroachment_detected;
    if (!isEncroaching) return null;
    
    // Scale slightly inward towards centroid to show encroached boundary visually
    const centroidLat = claim.polygon.reduce((sum, p) => sum + p[0], 0) / claim.polygon.length;
    const centroidLng = claim.polygon.reduce((sum, p) => sum + p[1], 0) / claim.polygon.length;
    
    return claim.polygon.map(coord => [
      centroidLat + (coord[0] - centroidLat) * 0.85,
      centroidLng + (coord[1] - centroidLng) * 0.85
    ]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'SUBMITTED': return 'var(--color-warning)';
      case 'ANALYZED': return 'var(--color-success)';
      case 'DISPUTED': return 'var(--color-purple)';
      case 'REFUNDED': return 'var(--color-text-muted)';
      default: return '#fff';
    }
  };

  return (
    <div style={{ animation: "fadeIn 0.4s ease-out" }}>
      
      {/* Top Navigation Back */}
      <div style={{ marginBottom: "20px" }}>
        <Link to="/demo" style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "var(--color-text-muted)", textDecoration: "none", fontSize: "14px" }}>
          <ArrowLeft size={16} /> Back to Gallery
        </Link>
      </div>

      {success && <div className="status-box success" style={{ marginBottom: "20px" }}><p>{success}</p></div>}
      {error && <div className="status-box error" style={{ marginBottom: "20px" }}><p>{error}</p></div>}

      {progress && (
        <div className="status-box" style={{ marginBottom: "20px" }}>
          <div className="spinner"></div>
          <div className="status-content" style={{ textAlign: "left" }}>
            <h4>Democratic AI Consensus Executing</h4>
            <p>
              {progress === 'PROPOSING' && "Leader node querying Overpass attic dates and fetching Planetary Computer STAC metadata..."}
              {progress === 'COMMITTING' && "Consensus gathering. Validator nodes executing comparative analysis..."}
              {progress === 'REVEALING' && "Democratic ballot verification in progress..."}
              {progress === 'FINALIZED' && "Forensic analysis finalized on-chain!"}
              {!['PROPOSING', 'COMMITTING', 'REVEALING', 'FINALIZED'].includes(progress) && `Consensus step: ${progress}`}
            </p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "24px", alignItems: "start" }}>
        
        {/* Left: Map & Reports */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Map display */}
          <div className="glass-card" style={{ padding: "24px", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={20} style={{ color: "var(--color-primary)" }} /> Parcel Footprint Map
              </h3>
              
              <div style={{ display: "flex", gap: "10px", fontSize: "11px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "10px", height: "10px", background: "var(--color-primary)", borderRadius: "2px" }}></span> Registered Claim
                </span>
                {(claim.ruling?.encroachment_detected || claim.dispute_ruling?.encroachment_detected) && (
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "10px", height: "10px", background: "var(--color-danger)", border: "1px dashed var(--color-danger)", borderRadius: "2px" }}></span> Encroachment Boundary
                  </span>
                )}
              </div>
            </div>

            <MapComponent 
              polygon={claim.polygon}
              encroachmentPolygon={getEncroachmentPolygon()}
              isDrawing={false}
              height="350px"
            />
          </div>

          {/* AI Forensic Analysis Report */}
          {claim.ruling && (
            <div className="glass-card" style={{ padding: "24px", border: "1px solid rgba(16, 185, 129, 0.2)", background: "rgba(16, 185, 129, 0.02)" }}>
              <h3 className="card-title" style={{ color: "var(--color-success)", borderColor: "rgba(16, 185, 129, 0.1)" }}>
                <Cpu size={18} /> AI Forensic Analysis Report
              </h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
                <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--color-text-muted)", display: "block", marginBottom: "4px" }}>VERDICT</span>
                  <strong style={{ fontSize: "16px", color: claim.ruling.encroachment_detected ? "var(--color-danger)" : "var(--color-success)" }}>
                    {claim.ruling.encroachment_detected ? "ENCROACHMENT" : "CLEAN"}
                  </strong>
                </div>
                <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--color-text-muted)", display: "block", marginBottom: "4px" }}>CONFIDENCE SCORE</span>
                  <strong style={{ fontSize: "18px", color: "var(--color-primary)" }}>
                    {(parseFloat(claim.ruling.confidence)*100).toFixed(0)}%
                  </strong>
                </div>
                <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--color-text-muted)", display: "block", marginBottom: "4px" }}>AREA DEVIATION</span>
                  <strong style={{ fontSize: "16px", color: "var(--color-warning)" }}>
                    {claim.ruling.area_lost_m2} m²
                  </strong>
                </div>
              </div>

              <div style={{ marginBottom: "20px", textAlign: "left" }}>
                <h4 style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 6px 0" }}>Consensus Reasoning Findings</h4>
                <p style={{ fontSize: "13px", lineHeight: "1.6", margin: 0 }}>{claim.ruling.reasoning}</p>
              </div>

              {claim.ruling.timeline && claim.ruling.timeline.length > 0 && (
                <div style={{ textAlign: "left" }}>
                  <h4 style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 12px 0" }}>Satellite Timeline Events</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {claim.ruling.timeline.map((evt, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <div style={{ background: "var(--color-primary)", color: "#fff", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold" }}>
                          {evt.year}
                        </div>
                        <div style={{ fontSize: "12px", lineHeight: "1.4" }}>{evt.event}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dispute Arbitration appeal report */}
          {claim.dispute && (
            <div className="glass-card" style={{ padding: "24px", border: "1px solid rgba(139, 92, 246, 0.2)", background: "rgba(139, 92, 246, 0.02)" }}>
              <h3 className="card-title" style={{ color: "var(--color-purple)", borderColor: "rgba(139, 92, 246, 0.1)" }}>
                <AlertTriangle size={18} /> Dispute Appeal Arbitration
              </h3>
              
              <div style={{ background: "rgba(0,0,0,0.15)", padding: "16px", borderRadius: "12px", textAlign: "left", marginBottom: "20px" }}>
                <span style={{ fontSize: "11px", color: "var(--color-purple)", fontWeight: "bold", display: "block", marginBottom: "4px" }}>OBJECTION REASONING</span>
                <p style={{ fontSize: "13px", margin: 0, fontStyle: "italic" }}>"{claim.dispute.reason}"</p>
              </div>

              {claim.dispute_ruling ? (
                <div style={{ textAlign: "left" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                    <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--color-text-muted)", display: "block", marginBottom: "4px" }}>ARBITRATION VERDICT</span>
                      <strong style={{ fontSize: "16px", color: claim.dispute_ruling.dispute_verdict === 'OVERTURN' ? "var(--color-danger)" : "var(--color-success)" }}>
                        {claim.dispute_ruling.dispute_verdict} RULING
                      </strong>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--color-text-muted)", display: "block", marginBottom: "4px" }}>ARBITRATOR CONFIDENCE</span>
                      <strong style={{ fontSize: "16px", color: "var(--color-primary)" }}>
                        {(parseFloat(claim.dispute_ruling.confidence)*100).toFixed(0)}%
                      </strong>
                    </div>
                  </div>

                  <h4 style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 6px 0" }}>Arbitration Spatial Analysis</h4>
                  <p style={{ fontSize: "13px", lineHeight: "1.6", margin: 0 }}>{claim.dispute_ruling.reasoning}</p>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px", alignItems: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                  <RotateCw className="spinner" size={16} />
                  <span>Arbitration query queued. Waiting for democracy consensus...</span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right: Metadata & Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Claim Info Card */}
          <div className="glass-card" style={{ padding: "24px", textAlign: "left" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 600 }}>Claim Metadata</h3>
            
            <div className="info-row" style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-glass)" }}>
              <span className="info-label" style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Claim ID</span>
              <span className="info-value" style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "bold" }}>{claim.id}</span>
            </div>

            <div className="info-row" style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-glass)" }}>
              <span className="info-label" style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Status</span>
              <span className="info-value" style={{ fontSize: "12px", fontWeight: "bold", padding: "2px 8px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", color: getStatusColor(claim.status) }}>
                {claim.status}
              </span>
            </div>

            <div className="info-row" style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-glass)" }}>
              <span className="info-label" style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Claim Owner</span>
              <span className="info-value" style={{ fontFamily: "monospace", fontSize: "13px", color: "var(--color-purple)" }}>
                {claim.owner.slice(0, 6)}...{claim.owner.slice(-4)}
              </span>
            </div>

            <div className="info-row" style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-glass)" }}>
              <span className="info-label" style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Year range</span>
              <span className="info-value" style={{ fontSize: "13px" }}>{claim.year_start} — {claim.year_end}</span>
            </div>

            <div className="info-row" style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-glass)" }}>
              <span className="info-label" style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Calculated Area</span>
              <span className="info-value" style={{ fontSize: "13px" }}>{claim.area_m2} m²</span>
            </div>

            <div className="info-row" style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 0" }}>
              <span className="info-label" style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Description Context</span>
              <span style={{ fontSize: "12px", color: "var(--color-text-main)", lineHeight: "1.4" }}>{claim.description}</span>
            </div>
          </div>

          {/* Soulbound Boundary Proof NFT details */}
          {claim.nft_minted && (
            <div className="glass-card" style={{ padding: "24px", border: "1px solid rgba(139, 92, 246, 0.3)", background: "linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%)", textAlign: "left" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: 600, color: "var(--color-purple)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Award size={18} /> Soulbound Boundary proof
              </h3>
              <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: "0 0 12px 0", lineHeight: "1.4" }}>
                An official on-chain Soulbound Token has been issued for this parcel. It represents an audited boundary verified by the democratic consensus of GenLayer.
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(0,0,0,0.2)", padding: "8px 12px", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Token ID</span>
                <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: "bold" }}>{claim.nft_token_id}</span>
              </div>
            </div>
          )}

          {/* Control Actions Card */}
          <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: 600, textAlign: "left" }}>Operations Console</h3>
            
            {claim.status === 'SUBMITTED' && (
              <button 
                className="btn-primary" 
                onClick={handleStartAnalysis}
                disabled={opsLoading}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {opsLoading ? <RotateCw className="spinner" size={16} /> : <Cpu size={16} />}
                Run AI Consensus Analysis
              </button>
            )}

            {claim.status === 'ANALYZED' && (
              <>
                <button 
                  className="btn-primary" 
                  onClick={handleClaimRefund}
                  disabled={opsLoading}
                  style={{ width: "100%", justifyContent: "center", background: "var(--color-success)" }}
                >
                  {opsLoading ? <RotateCw className="spinner" size={16} /> : <ShieldCheck size={16} />}
                  Claim Treasury Refund
                </button>

                {parseFloat(claim.ruling.confidence) >= 0.8 && !claim.nft_minted && (
                  <button 
                    className="btn-primary" 
                    onClick={handleMintSbt}
                    disabled={opsLoading}
                    style={{ width: "100%", justifyContent: "center", background: "var(--color-purple)" }}
                  >
                    {opsLoading ? <RotateCw className="spinner" size={16} /> : <Award size={16} />}
                    Mint Soulbound NFT (2 GEN)
                  </button>
                )}

                {!claim.dispute && (
                  <button 
                    className="btn-primary" 
                    onClick={() => navigate(`/dispute/${claim.id}`)}
                    disabled={opsLoading}
                    style={{ width: "100%", justifyContent: "center", background: "var(--color-warning)" }}
                  >
                    <AlertTriangle size={16} />
                    File Dispute Appeal (10 GEN)
                  </button>
                )}
              </>
            )}

            {claim.status === 'REFUNDED' && (
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", padding: "10px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
                This claim's locked stake has been fully refunded or liquidated in accordance with consensus arbitration.
              </div>
            )}
            
            {claim.status === 'DISPUTED' && (
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", padding: "10px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
                This claim has been appealed. The arbitration findings are displayed in the consensus detail card.
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
export default ClaimDetailPage;
