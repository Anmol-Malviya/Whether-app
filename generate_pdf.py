import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(45, 755, "WeatherPulse India — Architecture & System Specification")
            self.drawRightString(letter[0] - 45, 755, "Engineering & Algorithmic Whitepaper")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(45, 748, letter[0] - 45, 748)
            
        # Footer
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(45, 36, letter[0] - 45, 36)
        self.drawString(45, 25, "WeatherPulse: Crowdsourced Hyperlocal Weather Consensus & Emergency Triage")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 45, 25, page_str)
        self.restoreState()

def build_pdf(filename="WeatherPulse_Project_Overview.pdf"):
    # Margins 45pt to give clean professional breathing room and exact 3-page layout
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=45,
        rightMargin=45,
        topMargin=45,
        bottomMargin=45
    )

    PRIMARY = colors.HexColor("#0F172A")    # Slate 900
    ACCENT = colors.HexColor("#2563EB")     # Royal Blue
    SECONDARY = colors.HexColor("#0284C7")  # Sky Blue
    TEXT_DARK = colors.HexColor("#1E293B")  # Slate 800
    TEXT_MUTED = colors.HexColor("#475569") # Slate 600
    BG_LIGHT = colors.HexColor("#F8FAFC")
    BORDER_LIGHT = colors.HexColor("#CBD5E1")

    title_style = ParagraphStyle(
        'DocTitle',
        fontName='Helvetica-Bold',
        fontSize=21,
        leading=25,
        textColor=PRIMARY,
        spaceAfter=3
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        fontName='Helvetica',
        fontSize=10.5,
        leading=14,
        textColor=SECONDARY,
        spaceAfter=10
    )

    meta_style = ParagraphStyle(
        'MetaText',
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=TEXT_MUTED
    )

    h1_style = ParagraphStyle(
        'H1',
        fontName='Helvetica-Bold',
        fontSize=12.5,
        leading=16,
        textColor=PRIMARY,
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'H2',
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=ACCENT,
        spaceBefore=6,
        spaceAfter=3,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=TEXT_DARK,
        spaceAfter=4
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=TEXT_DARK,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=2
    )

    callout_style = ParagraphStyle(
        'Callout',
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=12.5,
        textColor=PRIMARY
    )

    code_style = ParagraphStyle(
        'CodeSnippet',
        fontName='Courier',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0F172A")
    )

    story = []

    # ═════════════════════════════════════════════════════════════════════════════
    # PAGE 1: TITLE, META, STORY & TECH STACK
    # ═════════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("WeatherPulse India", title_style))
    story.append(Paragraph("Hyperlocal Meteorological Consensus & AI-Driven Emergency Incident Triage Platform", subtitle_style))
    
    meta_box = [
        [Paragraph("<b>Project:</b> WeatherPulse Major Project", meta_style),
         Paragraph("<b>Classification:</b> Crowdsourced Meteo-Disaster Network", meta_style)],
        [Paragraph("<b>Stack:</b> Next.js 16 (App Router), React 19, MongoDB, Groq Vision, Cloudinary", meta_style),
         Paragraph("<b>Status:</b> Production System Architecture", meta_style)]
    ]
    t_meta = Table(meta_box, colWidths=[260, 262])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.8, BORDER_LIGHT),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_LIGHT),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 8))

    story.append(Paragraph("1. Conceptual Narrative: The Ground-Reality Disconnect", h1_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=ACCENT, spaceAfter=6))
    
    story_p1 = (
        "<b>The Citizen Story:</b> Consider a resident, Rahul, driving through Vijay Nagar, Indore. A 20-minute "
        "convective cloudburst leaves the intersection submerged under knee-deep water. Vehicles stall, creating a severe gridlock. "
        "Yet, opening mainstream weather apps reveals an inaccurate forecast: <i>'Light Drizzle, 28°C'</i>. "
        "This breakdown occurs because standard government sensors are fixed at regional airports 15–30 km away, "
        "wholly unaware of localized micro-climate rain bursts and localized municipal drainage failures."
    )
    story.append(Paragraph(story_p1, body_style))

    story_p2 = (
        "<b>The WeatherPulse Solution:</b> Rahul opens WeatherPulse and activates the camera. The system locks his "
        "precise device GPS coordinates, uploads the high-resolution photo to cloud storage, and feeds it into the "
        "Groq Llama 3.2 Vision engine. Within 900ms, the AI confirms active waterlogging, calculates depth, extracts road landmark text, "
        "and dispatches a high-priority card to the <b>Municipal Officer Triage Panel</b>. Drainage relief teams deploy "
        "before widespread flooding paralyzes the city corridor."
    )
    story.append(Paragraph(story_p2, body_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("2. Full-Stack Technical Architecture", h1_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=ACCENT, spaceAfter=6))

    stack_data = [
        [Paragraph("<b>Component / Layer</b>", meta_style), Paragraph("<b>Technology Specification</b>", meta_style), Paragraph("<b>Core Architectural Purpose</b>", meta_style)],
        [Paragraph("<b>Frontend Framework</b>", body_style), Paragraph("Next.js 16 + React 19 (App Router)", body_style), Paragraph("High-performance server-rendered hydration, live state reactivity, mobile-first UX.", body_style)],
        [Paragraph("<b>Styling System</b>", body_style), Paragraph("Tailwind CSS v4 + Lucide Icons", body_style), Paragraph("Adaptive dark/light glassmorphic UI, responsive incident status badges, animations.", body_style)],
        [Paragraph("<b>Database Storage</b>", body_style), Paragraph("MongoDB 7.0 + Mongoose 9.1", body_style), Paragraph("2dsphere GeoJSON spatial querying, raw moment storage, and automatic TTL index expiry.", body_style)],
        [Paragraph("<b>Multimodal AI Vision</b>", body_style), Paragraph("Groq API (Llama 3.2 11B Vision)", body_style), Paragraph("Sub-second multimodal vision inference: flood depth, OCR, and anti-spam verification.", body_style)],
        [Paragraph("<b>Media Pipeline</b>", body_style), Paragraph("Cloudinary v2 SDK", body_style), Paragraph("Direct Base64 media ingestion, optimized CDN hosting, automatic responsive resizing.", body_style)],
        [Paragraph("<b>Meteo Ingestion Suite</b>", body_style), Paragraph("Open-Meteo, WeatherAPI, OpenWeather", body_style), Paragraph("Triple-vendor parallel API dispatch, normalization, consensus aggregation.", body_style)]
    ]
    t_stack = Table(stack_data, colWidths=[120, 160, 242])
    t_stack.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_LIGHT),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    for c in range(3):
        t_stack._cellvalues[0][c].style.textColor = colors.white
    story.append(t_stack)

    # ═════════════════════════════════════════════════════════════════════════════
    # PAGE 2: ALGORITHMS & MATHEMATICAL SCORING
    # ═════════════════════════════════════════════════════════════════════════════
    story.append(PageBreak())

    story.append(Paragraph("3. Core Algorithmic Systems & Mathematical Scoring", h1_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=ACCENT, spaceAfter=6))

    story.append(Paragraph("A. Triple-Provider Consensus Scoring Engine (aggregator.ts)", h2_style))
    story.append(Paragraph(
        "Commercial weather apps fail when their single API source goes stale or drifts. WeatherPulse resolves "
        "this by fetching data in parallel from three heterogeneous APIs (Open-Meteo, WeatherAPI, OpenWeather) and applying "
        "a composite reliability formula yielding a confidence score <b>S ∈ [0, 100]</b>:",
        body_style
    ))

    formula_table = [
        [Paragraph("<b>Consensus Formula:</b> S = 0.40 · S_agreement + 0.30 · S_freshness + 0.30 · S_availability", code_style)]
    ]
    t_formula = Table(formula_table, colWidths=[522])
    t_formula.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EFF6FF")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#93C5FD")),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_formula)
    story.append(Spacer(1, 4))

    story.append(Paragraph("• <b>Agreement Score (S_agreement):</b> Compares temperature variance (ΔT) and condition taxonomy across vendors. "
                           "Temperature dispersion: <i>Score_temp = max(0, 100 - (ΔT_max · 20))</i>. A deviation > 5°C drops score to 0. "
                           "Condition matching computes intersection between rain/storm versus dry conditions. Composite: <i>0.6 · Score_temp + 0.4 · Score_condition</i>.", bullet_style))
    story.append(Paragraph("• <b>Freshness Score (S_freshness):</b> Continuous temporal decay function based on timestamp age: "
                           "<i>Score_fresh = max(0, min(100, 100 - (Age_minutes / 60) · 100))</i>. Readings < 10 mins old receive 100%; readings older than 60 mins decay to zero.", bullet_style))
    story.append(Paragraph("• <b>Availability Score (S_availability):</b> Ratio of healthy HTTP 200 responses against total configured provider endpoints (N_ok / N_total · 100).", bullet_style))
    story.append(Paragraph("• <b>Disagreement Flagging:</b> If temperature delta exceeds 3.0°C or condition codes collide (e.g., Rain vs Clear), automated warning flags are injected for user transparency.", bullet_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("B. Spatial-Temporal Haversine Incident Clustering (verificationEngine.ts)", h2_style))
    story.append(Paragraph(
        "When severe weather strikes, multiple citizens report the same incident. Without intelligent deduplication, "
        "emergency personnel are overwhelmed. The clustering engine executes the Great-Circle Haversine distance algorithm:",
        body_style
    ))

    hav_box = [
        [Paragraph("a = sin²(Δφ / 2) + cos(φ1) · cos(φ2) · sin²(Δλ / 2)<br/>"
                   "d = 2 · R · atan2(√a, √(1 - a))  where R = 6,371,000 meters (Earth's radius)<br/>"
                   "<b>Clustering Constraint:</b> If distance d ≤ 500m AND |t1 - t2| ≤ 30 mins → Corroborate into single IncidentCluster.", code_style)]
    ]
    t_hav = Table(hav_box, colWidths=[522])
    t_hav.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F5F9")),
        ('BOX', (0,0), (-1,-1), 1, BORDER_LIGHT),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_hav)
    story.append(Spacer(1, 4))
    story.append(Paragraph("• <b>Corroboration Confidence Boost:</b> An isolated report starts as 'unverified' (Confidence: 50%). If 2 or more citizens "
                           "report within 500m / 30 mins, status upgrades to 'corroborated' (+25%) and 'confirmed' (+40%).", bullet_style))
    story.append(Paragraph("• <b>Physical Plausibility Check:</b> Cross-checks cluster reports against current Doppler precipitation. If rain is reported "
                           "when radar indicates zero cloud cover, report priority is demoted to prevent malicious spoofing.", bullet_style))

    # ═════════════════════════════════════════════════════════════════════════════
    # PAGE 3: AI VISION PIPELINE, UI/UX WORKFLOW & CONCLUSION
    # ═════════════════════════════════════════════════════════════════════════════
    story.append(PageBreak())

    story.append(Paragraph("4. Multimodal AI Vision Engine (Groq & Llama 3.2 Vision)", h1_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=ACCENT, spaceAfter=6))
    story.append(Paragraph(
        "Uploaded citizen photographs are processed through the ultra-fast <b>Llama 3.2 11B Vision</b> model via "
        "Groq LPUs (<b>groqVision.ts</b>). The vision engine returns structured JSON evaluation covering 5 critical metrics:",
        body_style
    ))

    ai_table = [
        [Paragraph("<b>Vision Metric</b>", meta_style), Paragraph("<b>Algorithmic Function & Output Schema</b>", meta_style)],
        [Paragraph("<b>1. Authenticity Screening</b>", body_style),
         Paragraph("Detects and blocks invalid uploads (selfies, indoor rooms, computer monitors, internet memes, food). Emits <code>isValidWeatherPhoto: boolean</code>.", body_style)],
        [Paragraph("<b>2. Flood Depth Estimation</b>", body_style),
         Paragraph("Computes surface water reflection, tire submergence, and curb visibility. Categorizes depth into: <code>none</code> | <code>ankle_deep</code> | <code>knee_deep</code> | <code>submerged_vehicles</code>.", body_style)],
        [Paragraph("<b>3. Zero-Shot Signboard OCR</b>", body_style),
         Paragraph("Extracts optical text from commercial boards, mileposts, or street nameplates to independently confirm user GPS location.", body_style)],
        [Paragraph("<b>4. Hazard Classification</b>", body_style),
         Paragraph("Identifies secondary threats such as fallen electric wires, low-visibility downpours, or open drains, producing <code>detectedHazards: string[]</code>.", body_style)],
        [Paragraph("<b>5. Executive Triage Summary</b>", body_style),
         Paragraph("Generates an actionable 2-sentence English brief for municipal disaster officers with severity: <code>CRITICAL</code>, <code>HIGH</code>, <code>MEDIUM</code>, or <code>LOW</code>.", body_style)]
    ]
    t_ai = Table(ai_table, colWidths=[140, 382])
    t_ai.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_LIGHT),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    for c in range(2):
        t_ai._cellvalues[0][c].style.textColor = colors.white
    story.append(t_ai)
    story.append(Spacer(1, 8))

    story.append(Paragraph("5. UI/UX Design Process & Engineering Workflows", h1_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=ACCENT, spaceAfter=6))
    story.append(Paragraph("• <b>Camera Subsystem (CameraCapture.tsx):</b> Direct HTML5 media stream with live canvas snapshot capture and system file-picker fallback.", bullet_style))
    story.append(Paragraph("• <b>High-Accuracy Geolocation:</b> Dual-tier GPS lock with timeout failsafe, integrated with predefined coordinate matrices for tier-1/tier-2 Indian cities.", bullet_style))
    story.append(Paragraph("• <b>Officer Triage Panel (OfficerTriagePanel.tsx):</b> Live administrative incident board supporting severity sorting, coordinate review, and 1-click status transitions.", bullet_style))
    story.append(Paragraph("• <b>Ephemeral Data Retention:</b> Database records utilize MongoDB TTL (Time-To-Live) indexing to expire raw community moments automatically after 4–12 hours, ensuring minimal storage footprint.", bullet_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("6. Architectural Summary & Strategic Verdict", h1_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=ACCENT, spaceAfter=6))
    
    verdict_text = (
        "<b>Strategic Verdict:</b> WeatherPulse India transforms meteorological observation from passive remote estimation "
        "into a verified, real-time civic defense network. By uniting triple-provider consensus scoring, "
        "Haversine spatial-temporal clustering, and Groq Llama 3.2 Vision intelligence, the platform equips city administrators "
        "and citizens with unparalleled hyper-local disaster response capabilities."
    )
    callout_table = [
        [Paragraph(verdict_text, callout_style)]
    ]
    t_callout = Table(callout_table, colWidths=[522])
    t_callout.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F0FDF4")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#86EFAC")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_callout)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"SUCCESS: Generated {filename}")

if __name__ == "__main__":
    build_pdf()
