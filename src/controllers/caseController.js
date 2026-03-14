const Case = require("../models/Case");

/**
 * POST /api/cases
 * Create a new investigation case.
 */
exports.createCase = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title) return res.status(400).json({ message: "Title is required" });

    const newCase = new Case({
      title,
      description,
      createdBy: req.user.uid   // from Firebase token
    });

    await newCase.save();

    res.status(201).json({
      message: "Case created",
      case: newCase
    });
  } catch (err) {
    console.error("createCase error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * GET /api/cases
 * Get all cases.
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
 * Get a single case by ID.
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
