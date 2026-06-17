import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { GenSquatContext } from '../context/GenSquatContext';
import { 
  AlertTriangle, 
  RotateCw, 
  ArrowLeft, 
  CheckCircle, 
  HelpCircle,
  ShieldAlert,
  FileSearch,
  Scale
} from 'lucide-react';

export const DisputePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getClaimDetails, disputeClaim, getBalance } = useContext(GenSquatContext);

  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [opsLoading, setOpsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const handleSubmitDispute = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!reason.trim()) {
      setError("Please provide a technical reason objecting to the initial ruling.");
      return;
    }

    setOpsLoading(true);
    try {
      await disputeClaim(id, reason, (p) => setProgress(p));
      setSuccess("Arbitration successfully completed! Consensus results updated.");
      setProgress('');
      setReason('');
      await loadDetails();
    } catch (err) {
      setError(err.message || "Dispute transaction reverted.");
      setProgress('');
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
    <div style={{ animation: "fadeIn 0.4s ease-out" }}>
      
      {/* Back to details */}
      <div style={{ marginBottom: "20px" }}>
        <Link to={`/claim/${id}`} style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "var(--color-text-muted)", textDecoration: "none", fontSize: "14px" }}>
          <ArrowLeft size={16} /> Back to Claim Details
        </Link>
      </div>

      {success && <div className="status-box success" style={{ marginBottom: "20px" }}><p>{success}</p></div>}
      {error && <div className="status-box error" style={{ marginBottom: "20px" }}><p>{error}</p></div>}

      {progress && (
        <div className="status-box" style={{ marginBottom: "20px" }}>
          <div className="spinner"></div>
          <div className="status-content" style={{ textAlign: "left" }}>
            <h4>Arbitration Consensus Running</h4>
            <p>
              {progress === 'PROPOSING' && "Arbitrator compiling higher resolution zoom indices..."}
              {progress === 'COMMITTING' && "Consensus gathering. Validators reviewing canopy density shifts..."}
              {progress === 'REVEALING' && "Arbitration ballot verification in progress..."}
              {progress === 'FINALIZED' && "Dispute arbitration finalized!"}
              {!['PROPOSING', 'COMMITTING', 'REVEALING', 'FINALIZED'].includes(progress) && `Consensus stage: ${progress}`}
            </p>
          </div>
        </div>
      )}

      {/* Main content split */}
      {!claim.dispute ? (
        // Submit Dispute Form
        <div className="glass-card" style={{ maxWidth: "600px", margin: "0 auto", padding: "24px", textAlign: "left" }}>
          <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 16px 0", color: "var(--color-warning)" }}>
            <ShieldAlert size={20} /> File Dispute Appeal
          </h3>
          
          <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "20px", lineHeight: "1.5" }}>
            Appeal the initial ruling of <strong>{id}</strong>. The VM will perform multi-party cross-checks using a higher zoom factor (level 19 red-edge band) and re-analyze the OSM registry database to verify edge layouts.
          </p>

          <form onSubmit={handleSubmitDispute}>
            <div className="form-group" style={{ marginBottom: "20px" }}>
              <label className="form-label">Objection Grounds & Evidence Description</label>
              <textarea 
                className="textarea-input"
                rows={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why the initial ruling is wrong. Point out coordinates, crop canopy shifts, shadows, or road clearings that validators should re-inspect..."
              />
            </div>

            {/* Stake Box */}
            <div className="status-box" style={{ background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.15)", marginBottom: "20px" }}>
              <HelpCircle size={16} style={{ color: "var(--color-warning)" }} />
              <div className="status-content" style={{ fontSize: "12px" }}>
                <strong>Arbitration Stake:</strong> Appellants must lock exactly <strong>10.0 GEN</strong>. If the appeal is successful (verdict overturned), this stake is fully refunded and you earn a <strong>2.5 GEN reward</strong> from the claimant's liquidated stake.
                <br />
                <span style={{ color: "var(--color-text-muted)" }}>Current Balance: {getBalance().toFixed(2)} GEN</span>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              disabled={opsLoading}
              style={{ width: "100%", justifyContent: "center", background: "var(--color-warning)" }}
            >
              {opsLoading ? <RotateCw className="spinner" size={16} /> : <Scale size={16} />}
              File Appeal & Stake 10 GEN
            </button>
          </form>
        </div>
      ) : (
        // Side-by-side Arbitration Comparison
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 24px 0", textAlign: "left" }}>
            Dispute Arbitration Verdicts: {id}
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            
            {/* Left Card: Initial Ruling */}
            <div className="glass-card" style={{ padding: "24px", textAlign: "left", borderColor: "rgba(16, 185, 129, 0.2)" }}>
              <h3 className="card-title" style={{ color: "var(--color-success)", display: "flex", alignItems: "center", gap: "8px" }}>
                <FileSearch size={18} /> Initial Forensic Ruling
              </h3>
              
              <div className="info-row" style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-glass)" }}>
                <span style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Encroachment Detected</span>
                <strong style={{ fontSize: "14px", color: claim.ruling.encroachment_detected ? "var(--color-danger)" : "var(--color-success)" }}>
                  {claim.ruling.encroachment_detected ? "YES" : "NO"}
                </strong>
              </div>

              <div className="info-row" style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-glass)" }}>
                <span style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Confidence Score</span>
                <strong style={{ fontSize: "14px" }}>{(parseFloat(claim.ruling.confidence)*100).toFixed(0)}%</strong>
              </div>

              <div style={{ marginTop: "16px" }}>
                <h4 style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: "0 0 6px 0" }}>Findings</h4>
                <p style={{ fontSize: "13px", lineHeight: "1.5", margin: 0 }}>{claim.ruling.reasoning}</p>
              </div>
            </div>

            {/* Right Card: Arbitration Ruling */}
            <div className="glass-card" style={{ padding: "24px", textAlign: "left", borderColor: "rgba(139, 92, 246, 0.2)", background: "rgba(139, 92, 246, 0.01)" }}>
              <h3 className="card-title" style={{ color: "var(--color-purple)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Scale size={18} /> Dispute Arbitration Appeal
              </h3>

              <div className="info-row" style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-glass)" }}>
                <span style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Verdict Appeal</span>
                <strong style={{ fontSize: "14px", color: claim.dispute_ruling?.dispute_verdict === 'OVERTURN' ? "var(--color-danger)" : "var(--color-success)" }}>
                  {claim.dispute_ruling?.dispute_verdict}
                </strong>
              </div>

              <div className="info-row" style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-glass)" }}>
                <span style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Arbitration Confidence</span>
                <strong style={{ fontSize: "14px" }}>{(parseFloat(claim.dispute_ruling?.confidence)*100).toFixed(0)}%</strong>
              </div>

              <div className="info-row" style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-glass)" }}>
                <span style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>New Encroachment Status</span>
                <strong style={{ fontSize: "14px", color: claim.dispute_ruling?.encroachment_detected ? "var(--color-danger)" : "var(--color-success)" }}>
                  {claim.dispute_ruling?.encroachment_detected ? "YES" : "NO"}
                </strong>
              </div>

              <div style={{ marginTop: "16px" }}>
                <h4 style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: "0 0 6px 0" }}>Arbitration Spatial Evidence</h4>
                <p style={{ fontSize: "13px", lineHeight: "1.5", margin: 0 }}>{claim.dispute_ruling?.reasoning}</p>
              </div>
            </div>

          </div>

          {/* Refund Notice */}
          <div className="status-box" style={{ background: "rgba(139, 92, 246, 0.05)", border: "1px solid rgba(139, 92, 246, 0.15)", marginTop: "24px", textAlign: "left" }}>
            <Scale size={18} style={{ color: "var(--color-purple)" }} />
            <div className="status-content">
              <h4>Arbitration Settlements Finalized</h4>
              <p style={{ fontSize: "12px", margin: "4px 0 0 0" }}>
                {claim.dispute_ruling?.dispute_verdict === 'OVERTURN' 
                  ? "Verdicts shifted. The challenger's 10 GEN dispute stake has been refunded along with a 2.5 GEN reward. Claimant's 5 GEN stake liquidated (50% reward, 50% surplus)."
                  : "Original verdict upheld. Claimant's initial 5 GEN refund is unlocked. Challenger's 10 GEN stake has been distributed (50% to claimant as compensation, 50% to surplus)."}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default DisputePage;
