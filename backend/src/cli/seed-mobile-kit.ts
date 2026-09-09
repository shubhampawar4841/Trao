import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

dotenv.config();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");

  await mongoose.connect(uri);

  const User =
    mongoose.models.User ||
    mongoose.model(
      "User",
      new mongoose.Schema({
        email: String,
        passwordHash: String,
      })
    );

  const Kit =
    mongoose.models.Kit ||
    mongoose.model(
      "Kit",
      new mongoose.Schema(
        {
          userId: mongoose.Schema.Types.ObjectId,
          input: Object,
          kit: Object,
          status: String,
          editorState: Object,
          practice: Array,
        },
        { timestamps: true }
      )
    );

  const email = "mobile-check@trao.test";
  const password = "mobilecheck1";

  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      email,
      passwordHash: await bcrypt.hash(password, 10),
    });
  }

  const benchmark = JSON.parse(
    fs.readFileSync(
      path.resolve("../kits-benchmark.json"),
      "utf8"
    )
  );

  const caseKit = benchmark.kits.find(
    (item: { status: string; id: string }) =>
      item.status === "ok" && item.id === "case-trao-swe"
  );

  if (!caseKit?.kit) {
    throw new Error("No case-trao-swe kit in kits-benchmark.json");
  }

  await Kit.deleteMany({ userId: user._id });

  const doc = await Kit.create({
    userId: user._id,
    input: {
      jd: "Software Engineer React Node",
      companyUrl: "https://www.trao.ai",
      days: 5,
    },
    kit: caseKit.kit,
    status: "completed",
    editorState: {
      editedQuestionIds: [],
      pinnedQuestionIds: [],
      manualQuestionIds: [],
      editedFlashcardIds: [],
      pinnedFlashcardIds: [],
      manualFlashcardIds: [],
    },
    practice: [],
  });

  console.log(
    JSON.stringify({
      email,
      password,
      kitId: String(doc._id),
    })
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
