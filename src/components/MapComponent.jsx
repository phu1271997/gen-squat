import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icon asset paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to dynamically update map center/zoom
const MapUpdater = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 0) {
      // Calculate bounding box or centroid
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    }
  }, [coords, map]);
  return null;
};

// Map click handler to add coordinates
const MapClickHandler = ({ onMapClick, isDrawing }) => {
  const map = useMap();
  useEffect(() => {
    if (!isDrawing) return;
    const onClick = (e) => {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [isDrawing, onMapClick, map]);
  return null;
};

export const MapComponent = ({ 
  polygon = [], 
  onChangePolygon, 
  isDrawing = false, 
  encroachmentPolygon = null,
  height = "350px"
}) => {
  const defaultCentroid = [10.7772, 106.7012]; // HCMC default
  const centroid = polygon.length > 0 
    ? [
        polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length,
        polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length
      ]
    : defaultCentroid;

  const handleMapClick = (latlng) => {
    if (onChangePolygon) {
      // Limit to 10 points for boundary sanity
      if (polygon.length < 10) {
        onChangePolygon([...polygon, latlng]);
      }
    }
  };

  const removeVertex = (indexToRemove) => {
    if (onChangePolygon) {
      onChangePolygon(polygon.filter((_, idx) => idx !== indexToRemove));
    }
  };

  return (
    <div style={{ height, width: "100%", borderRadius: "12px", overflow: "hidden", position: "relative" }}>
      <MapContainer 
        center={centroid} 
        zoom={17} 
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Main Claim Polygon */}
        {polygon.length >= 3 && (
          <Polygon 
            positions={polygon} 
            pathOptions={{ 
              color: 'var(--color-primary, #3b82f6)', 
              fillColor: 'var(--color-primary, #3b82f6)', 
              fillOpacity: 0.15,
              weight: 3
            }} 
          />
        )}

        {/* Encroachment Shifted Polygon */}
        {encroachmentPolygon && encroachmentPolygon.length >= 3 && (
          <Polygon 
            positions={encroachmentPolygon} 
            pathOptions={{ 
              color: 'var(--color-danger, #ef4444)', 
              fillColor: 'var(--color-danger, #ef4444)', 
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '5, 5'
            }} 
          />
        )}

        {/* Draw Markers for vertices when drawing is enabled */}
        {polygon.map((coord, idx) => (
          <Marker 
            key={idx} 
            position={coord}
            interactive={isDrawing}
          >
            {isDrawing && (
              <Popup>
                <div style={{ fontSize: "12px", color: "#000" }}>
                  <strong>Vertex {idx + 1}</strong>
                  <br />
                  Lat: {coord[0].toFixed(5)}
                  <br />
                  Lng: {coord[1].toFixed(5)}
                  <br />
                  <button 
                    onClick={() => removeVertex(idx)}
                    style={{ 
                      marginTop: "6px", 
                      padding: "2px 6px", 
                      background: "var(--color-danger, #ef4444)", 
                      color: "#fff", 
                      border: "none", 
                      borderRadius: "4px",
                      cursor: "pointer"
                    }}
                  >
                    Delete Vertex
                  </button>
                </div>
              </Popup>
            )}
          </Marker>
        ))}

        <MapUpdater coords={polygon.length > 0 ? polygon : [defaultCentroid]} />
        <MapClickHandler onMapClick={handleMapClick} isDrawing={isDrawing} />
      </MapContainer>
      
      {isDrawing && (
        <div style={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          zIndex: 1000,
          background: "rgba(11, 15, 25, 0.95)",
          padding: "6px 12px",
          borderRadius: "8px",
          border: "1px solid var(--border-glass)",
          fontSize: "11px",
          color: "var(--color-text-muted)"
        }}>
          {polygon.length < 3 
            ? "Click on the map to define at least 3 boundary corners." 
            : `Coordinates locked: ${polygon.length} vertices.`}
        </div>
      )}
    </div>
  );
};
export default MapComponent;
