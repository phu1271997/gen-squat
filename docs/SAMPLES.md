# Sample disputes with reviewable land evidence

Judges need **concrete land inputs** the contract can analyze. GenSquat hosts
public HTML parcel pages under `/samples/` on the live app. The UI presets fill
`land_evidence_url` automatically; `analyze_claim` calls `web.render` on that URL.

| Case | Sample page | Polygon | Path |
|---|---|---|---|
| HCMC encroachment | Parcel D2-4418 | District 2 residential | `/samples/hcmc-land-record.html` |
| Hanoi clean | Parcel HK-902 | Hoan Kiem commercial | `/samples/hanoi-land-record.html` |
| Dak Lak dispute | Parcel DL-77 | Coffee farm road | `/samples/daklak-land-record.html` |

**Payable reminder:** submit **5 GEN**, dispute **10 GEN**, mint **2 GEN**.

---

## Case 1: District 2 HCMC Encroachment (Encroachment Detected)

### Metadata
- **Evidence URL:** `https://gen-squat.vercel.app/samples/hcmc-land-record.html`
- **Claim ID (on-chain):** `claim_N` after live `submit_claim`
- **Polygon Bounds:** `[[10.7769, 106.7009], [10.7775, 106.7009], [10.7775, 106.7015], [10.7769, 106.7015]]`
- **Year Range:** 2015 — 2025
- **Area:** 660 m²

### Context
A residential property in HCMC. The neighbor rebuilt a concrete boundary wall in 2021. The claimant alleges the new fence shifts 1.8 meters eastwards, encroaching into their land. The public evidence page includes parcel id, survey notes, and photo log text.

### Consensus Verdict
- **Verdict:** Encroachment Detected
- **Confidence Score:** 94%
- **Area Lost:** 55 m²
- **AI Spatial Reasoning:** 
  "Comparisons between Sentinel-2 multi-spectral timelines and OpenStreetMap historical ways confirm that the perimeter fence line was shifted eastwards by 1.8 meters in early 2021. Overpass attic data from 2015-2020 registers the fence at boundary nodes `[10.7772, 106.7009]`, which has been deleted in current layouts and replaced by node paths inside the claimant's registered polygon."

---

## Case 2: Hanoi Storefront (Clean Boundary)

### Metadata
- **Claim ID:** `demo_hanoi` (on-chain equivalent: `claim_2`)
- **Owner Address:** `0xdC18Aa3db8bc91A6E390A35e7D0811246fF3aB01`
- **Polygon Bounds:** `[[21.0285, 105.8542], [21.0295, 105.8542], [21.0295, 105.8552], [21.0285, 105.8552]]`
- **Year Range:** 2018 — 2024
- **Area:** 12,100 m²

### Context
A commercial storefront building in Hoan Kiem District, Hanoi. The owner is seeking official certified verification before starting a major architectural renovation.

### Consensus Verdict
- **Verdict:** Clean Boundary (No Encroachment)
- **Confidence Score:** 98%
- **Area Lost:** 0 m²
- **AI Spatial Reasoning:**
  "Historical satellite imagery and Overpass API query logs show no perimeter changes. All brick layout markers registered in the 2018 attic maps align perfectly with current physical features. No encroachment detected."

---

## Case 3: Dak Lak Coffee Farm (Dispute & Overturned Appeal)

### Metadata
- **Claim ID:** `demo_daklak` (on-chain equivalent: `claim_3`)
- **Owner Address:** `0x2bd806c97F0e00aF1a1fC3328fA763a9269723C8`
- **Polygon Bounds:** `[[12.6712, 108.0382], [12.6722, 108.0382], [12.6722, 108.0392], [12.6712, 108.0392]]`
- **Year Range:** 2016 — 2025
- **Area:** 12,100 m²

### Lifecycle Process Flow
1. **Initial Claim Submission:** Submitter registers the farm boundary.
2. **Initial Analysis:** Due to cloud cover, initial analysis returns "Clean" with low confidence (65%). No refund is claimed yet.
3. **Dispute Appeal:** Challenger (neighbor) appeals with a 10 GEN stake, requesting high-resolution red-edge band analysis.
4. **Democratic Arbitration:** The arbitration consensus resolves at a higher resolution, discovering that the neighbor indeed cleared a tree canopy buffer zone starting mid-2021 to widen an agricultural road by 3 meters inside the claimant's plot.
5. **Final Verdict:** Verdict **OVERTURNED** (Encroachment Detected, 92% confidence, 112 m² lost).
