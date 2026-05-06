const express = require("express");
const app = express();
const multer = require("multer");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

/* ================= MIDDLEWARE ================= */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "views/purple-free/src")));

app.set("view engine", "ejs");

/* ================= DATABASE ================= */

mongoose
  .connect("mongodb://127.0.0.1:27017/mydb")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

const productSchema = new mongoose.Schema({
  name: String,
  file: String,
});

const productModel = mongoose.model("product", productSchema);

/* ================= MULTER ================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

/* ================= ROUTES ================= */

// ADMIN
app.get("/admin", (req, res) => {
  res.render("purple-free/src/index");
});

app.get("/admin/users", async (req, res) => {
  const users = await productModel.find();
  res.render("purple-free/src/basic-table", { users });
});

// PAGES
app.get("/", (req, res) => res.render("home"));
app.get("/about", (req, res) => res.render("about"));
app.get("/contact", (req, res) => res.render("contact"));
app.get("/signup", (req, res) => res.render("signup"));

// USERS LIST
app.get("/users", async (req, res) => {
  const users = await productModel.find();
  res.render("users", { users });
});

// SIGNUP (CREATE)
app.post("/signup", upload.single("file"), async (req, res) => {
  try {
    const details = {
      name: req.body.name,
      file: req.file ? req.file.filename : "",
    };

    await productModel.create(details);
    res.redirect("/users");
  } catch (err) {
    console.error(err);
    res.send("Signup error");
  }
});

// EDIT PAGE
app.get("/edit/:id", async (req, res) => {
  const user = await productModel.findById(req.params.id);
  res.render("editsignup", { user });
});

// UPDATE
app.post("/edit/:id", upload.single("file"), async (req, res) => {
  const updateData = {
    name: req.body.name,
  };

  if (req.file) {
    updateData.file = req.file.filename;
  }

  await productModel.findByIdAndUpdate(req.params.id, updateData);
  res.redirect("/users");
});

// DELETE
app.get("/delete/:id", async (req, res) => {
  const user = await productModel.findById(req.params.id);

  if (user && user.file) {
    const filePath = path.join(__dirname, "uploads", user.file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  await productModel.findByIdAndDelete(req.params.id);
  res.redirect("/users");
});

/* ================= SERVER ================= */

app.listen(9000, () => {
  console.log("Server running on http://localhost:9000");
});
