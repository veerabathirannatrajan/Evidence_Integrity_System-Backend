const Case = require("../models/Case");

/**
 * POST /api/cases
 * Create a new investigation case.
 * Body: { title, description, priority, caseType, location, caseRef, incidentDate }
 */
exports.createCase = async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      caseType,
      location,
      caseRef,
      incidentDate,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    const newCase = new Case({
      title:        title.trim(),
      description:  description?.trim() || "",
      priority:     priority     || "medium",
      caseType:     caseType     || "criminal",
      location:     location     || "",
      caseRef:      caseRef      || "",
      incidentDate: incidentDate ? new Date(incidentDate) : new Date(),
      createdBy:    req.user.uid,   // from Firebase token
      status:       "open",
    });

    await newCase.save();

    res.status(201).json({
      message: "Case created successfully",
      case: newCase,
    });
  } catch (err) {
    console.error("createCase error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * GET /api/cases
 * Get all cases (sorted newest first).
 */
exports.getAllCases = async (req, res) => {
  try {
    const cases = await Case.find().sort({ createdAt: -1 });
    res.json(cases);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * GET /api/cases/:id
 * Get a single case by MongoDB ID.
 */
exports.getCaseById = async (req, res) => {
  try {
    const c = await Case.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Case not found" });
    res.json(c);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * PATCH /api/cases/:id/status
 * Update case status.
 * Body: { status: "open" | "closed" | "under_review" }
 */
exports.updateCaseStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ["open", "closed", "under_review"];
    
    if (!valid.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    
    const updated = await Case.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!updated) return res.status(404).json({ message: "Case not found" });
    
    res.json({ 
      message: "Status updated successfully", 
      case: updated 
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * PATCH /api/cases/:id
 * Update case details (all fields).
 * Body: { title, description, priority, caseType, location, caseRef, incidentDate, status }
 */
exports.updateCase = async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      caseType,
      location,
      caseRef,
      incidentDate,
      status
    } = req.body;

    // Build update object with only provided fields
    const updateData = {};
    
    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || "";
    if (priority) updateData.priority = priority;
    if (caseType) updateData.caseType = caseType;
    if (location !== undefined) updateData.location = location || "";
    if (caseRef !== undefined) updateData.caseRef = caseRef || "";
    if (incidentDate) updateData.incidentDate = new Date(incidentDate);
    if (status) {
      const valid = ["open", "closed", "under_review"];
      if (!valid.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      updateData.status = status;
    }

    const updated = await Case.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: "Case not found" });

    res.json({
      message: "Case updated successfully",
      case: updated
    });
  } catch (err) {
    console.error("updateCase error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * DELETE /api/cases/:id
 * Delete a case (optional - use with caution).
 */
exports.deleteCase = async (req, res) => {
  try {
    const deleted = await Case.findByIdAndDelete(req.params.id);
    
    if (!deleted) return res.status(404).json({ message: "Case not found" });
    
    res.json({ 
      message: "Case deleted successfully",
      case: deleted 
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * GET /api/cases/stats
 * Get case statistics for dashboard.
 */
exports.getCaseStats = async (req, res) => {
  try {
    const total = await Case.countDocuments();
    const open = await Case.countDocuments({ status: "open" });
    const closed = await Case.countDocuments({ status: "closed" });
    const underReview = await Case.countDocuments({ status: "under_review" });
    
    // Priority breakdown
    const low = await Case.countDocuments({ priority: "low" });
    const medium = await Case.countDocuments({ priority: "medium" });
    const high = await Case.countDocuments({ priority: "high" });
    const critical = await Case.countDocuments({ priority: "critical" });

    // Case type breakdown
    const criminal = await Case.countDocuments({ caseType: "criminal" });
    const civil = await Case.countDocuments({ caseType: "civil" });
    const cyber = await Case.countDocuments({ caseType: "cyber" });
    const fraud = await Case.countDocuments({ caseType: "fraud" });
    const narcotics = await Case.countDocuments({ caseType: "narcotics" });
    const other = await Case.countDocuments({ caseType: "other" });

    res.json({
      total,
      byStatus: { open, closed, underReview },
      byPriority: { low, medium, high, critical },
      byType: { criminal, civil, cyber, fraud, narcotics, other },
      recentActivity: {
        lastWeek: await Case.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};