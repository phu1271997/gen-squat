import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { GenSquatContext } from '../context/GenSquatContext';
import MapComponent from '../components/MapComponent';
import { FileText, Map, CheckCircle, RotateCw, AlertTriangle, HelpCircle } from 'lucide-react';

const COORD_PRESETS = {
  HCMC: {
    name: "District 2 HCMC (Encroachment)",
    polygon: [[10.7769, 106.7009], [10.7775, 106.7009], [10.7775, 106.7015], [10.7769, 106.7015]],
    yearStart: 2015,
    yearEnd: 2025,
    description: "My family's residential plot in District 2, HCMC. Neighbor has rebuilt their fence over the years, seemingly pushing eastwards into my property boundary."
  },
  HANOI: {
    name: "Hoan Kiem Hanoi (Clean Boundary)",
    polygon: [[21.0285, 105.8542], [21.0295, 105.8542], [21.0295, 105.8552], [21.0285, 105.8552]],
    yearStart: 2018,
    yearEnd: 2024,
    description: "A commercial plot located in Hoan Kiem District. Seeking official boundary verification before starting design phases for a commercial storefront."
  },
  DAKLAK: {
    name: "Dak Lak Farm (Agricultural dispute)",
    polygon: [[12.6712, 108.0382], [12.6722, 108.0382], [12.6722, 108.0392], [12.6712, 108.0392]],
    yearStart: 2016,
    yearEnd: 2025,
    description: "Agricultural coffee farm boundary. Suspect neighboring plantation has cleared trees and expanded road lanes inside our eastern boundary coordinates."
  }
};

export const SubmitClaimPage = () => {
  const { submitClaim, getBalance } = useContext(GenSquatContext);
  const navigate = useNavigate();

  const [polygon, setPolygon] = useState(COORD_PRESETS.HCMC.polygon);
  const [yearStart, setYearStart] = useState(COORD_PRESETS.HCMC.yearStart);
  const [yearEnd, setYearEnd] = useState(COORD_PRESETS.HCMC.yearEnd);
  const [description, setDescription] = useState(COORD_PRESETS.HCMC.description);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSelectPreset = (key) => {
    const preset = COORD_PRESETS[key];
    setPolygon(preset.polygon);
    setYearStart(preset.yearStart);
    setYearEnd(preset.yearEnd);
    setDescription(preset.description);
    setSuccess(`Preset "${preset.name}" loaded successfully.`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleClearMap = () => {
    setPolygon([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (polygon.length < 3) {
      setError("Please draw or select a valid closed polygon boundary with at least 3 coordinates.");
      return;
    }

    if (parseInt(yearStart) < 2015) {
      setError("Start year cannot be before 2015 due to Sentinel-2 satellite data availability.");
      return;
    }

    if (parseInt(yearStart) >= parseInt(yearEnd)) {
      setError("Start year must be strictly before end year.");
      return;
    }

    if (!description.trim()) {
      setError("Please enter a short description of the dispute boundary details.");
      return;
    }

    setLoading(true);
    try {
      const polygonJson = JSON.stringify(polygon);
      const claimId = await submitClaim(polygonJson, yearStart, yearEnd, description);
      setSuccess(`Claim successfully registered! Assigned Claim ID: ${claimId}`);
      setTimeout(() => {
        navigate(`/claim/${claimId}`);
      }, 1500);
    } catch (err) {
      setError(err.message || "Transaction reverted or failed. Check balance / settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start", animation: "fadeIn 0.4s ease-out" }}>
      
      {/* Left Column: Form & Presets */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 20px 0" }}>
          <FileText size={20} className="logo-icon" />
          Submit Boundary Claim
        </h3>
        
        {success && <div className="status-box success" style={{ marginBottom: "16px" }}><p>{success}</p></div>}
        {error && <div className="status-box error" style={{ marginBottom: "16px" }}><p>{error}</p></div>}

        <form onSubmit={handleSubmit}>
          {/* Preset Buttons */}
          <div className="form-group" style={{ marginBottom: "16px" }}>
            <label className="form-label">Quick Templates</label>
            <div className="template-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              <button type="button" className="template-btn" onClick={() => handleSelectPreset('HCMC')}>
                <strong>HCMC</strong>
                <span>Encroachment</span>
              </button>
              <button type="button" className="template-btn" onClick={() => handleSelectPreset('HANOI')}>
                <strong>Hanoi</strong>
                <span>Clean</span>
              </button>
              <button type="button" className="template-btn" onClick={() => handleSelectPreset('DAKLAK')}>
                <strong>Dak Lak</strong>
                <span>Agricultural</span>
              </button>
            </div>
          </div>

          {/* Polygon JSON display */}
          <div className="form-group" style={{ marginBottom: "16px" }}>
            <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Polygon Coordinates</span>
              <button type="button" onClick={handleClearMap} style={{ background: "transparent", border: "none", color: "var(--color-danger)", cursor: "pointer", fontSize: "11px" }}>
                Reset Coordinates
              </button>
            </label>
            <textarea 
              className="textarea-input"
              rows={3}
              readOnly
              value={polygon.length > 0 ? JSON.stringify(polygon) : ""}
              placeholder="Click on the Leaflet map to draw your boundaries, or load a preset template."
              style={{ fontFamily: "monospace", fontSize: "12px", background: "rgba(0,0,0,0.15)" }}
            />
          </div>

          {/* Years */}
          <div className="form-row" style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Start Year</label>
              <input 
                type="number" 
                className="text-input"
                min="2015"
                max="2026"
                value={yearStart}
                onChange={(e) => setYearStart(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">End Year</label>
              <input 
                type="number" 
                className="text-input"
                min="2016"
                max="2026"
                value={yearEnd}
                onChange={(e) => setYearEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Context details */}
          <div className="form-group" style={{ marginBottom: "24px" }}>
            <label className="form-label">Claim Details & Context</label>
            <textarea 
              className="textarea-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide evidence descriptions or neighbour fencing details..."
            />
          </div>

          {/* Stake reminder box */}
          <div className="status-box" style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.15)", marginBottom: "20px" }}>
            <HelpCircle size={16} style={{ color: "var(--color-primary)" }} />
            <div className="status-content" style={{ fontSize: "12px", textAlign: "left" }}>
              <strong>Staking Requirement:</strong> Submitting a claim locks exactly <strong>5.0 GEN</strong> in the Treasury. This is refunded upon successful analysis validation, or subject to arbitration splits.
              <br />
              <span style={{ color: "var(--color-text-muted)" }}>Current Balance: {getBalance().toFixed(2)} GEN</span>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {loading ? <RotateCw className="spinner" size={16} /> : <CheckCircle size={16} />}
            Submit Claim & Stake 5 GEN
          </button>
        </form>
      </div>

      {/* Right Column: Leaflet Map */}
      <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
          <Map size={20} className="logo-icon" />
          Interactive Parcel Designer
        </h3>
        
        <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: 0, textAlign: "left", lineHeight: "1.4" }}>
          Use the map to visual-check boundaries. Click to place vertices sequentially to draw a custom parcel footprint. 
        </p>

        <MapComponent 
          polygon={polygon}
          onChangePolygon={setPolygon}
          isDrawing={true}
          height="380px"
        />

        {polygon.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--color-text-muted)", borderTop: "1px solid var(--border-glass)", paddingTop: "12px" }}>
            <span>Vertices: {polygon.length}</span>
            <span>Centroid: {(polygon.reduce((s,c)=>s+c[0],0)/polygon.length).toFixed(4)}, {(polygon.reduce((s,c)=>s+c[1],0)/polygon.length).toFixed(4)}</span>
          </div>
        )}
      </div>

    </div>
  );
};
export default SubmitClaimPage;
