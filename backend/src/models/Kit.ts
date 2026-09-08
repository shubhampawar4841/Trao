import mongoose, { Schema, Document } from "mongoose";

export interface IKit extends Document {
  userId: mongoose.Types.ObjectId;

  input: {
    jd: string;
    companyUrl: string;
    days: number;
  };

  kit: Record<string, unknown>;

  status: "generating" | "completed" | "failed";

  error?: {
    code?: string;
    message?: string;
  };

  editorState: {
    editedQuestionIds: string[];
    pinnedQuestionIds: string[];
    manualQuestionIds: string[];

    editedFlashcardIds: string[];
    pinnedFlashcardIds: string[];
    manualFlashcardIds: string[];
  };

  practice: Array<{
    flashcardId: string;
    confidence: number;
    timesReviewed: number;
    lastPracticedAt?: Date;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

const PracticeSchema = new Schema(
  {
    flashcardId: {
      type: String,
      required: true,
    },

    confidence: {
      type: Number,
      min: 1,
      max: 3,
      default: 1,
    },

    timesReviewed: {
      type: Number,
      default: 0,
    },

    lastPracticedAt: {
      type: Date,
    },
  },
  {
    _id: false,
  }
);

const KitSchema = new Schema<IKit>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    input: {
      jd: {
        type: String,
        required: true,
      },

      companyUrl: {
        type: String,
        required: true,
      },

      days: {
        type: Number,
        required: true,
        min: 1,
        max: 60,
      },
    },

    /*
      The generated kit itself is validated with our
      Zod KitSchema BEFORE being saved.
    */
    kit: {
      type: Schema.Types.Mixed,
      required: true,
    },

    status: {
      type: String,
      enum: ["generating", "completed", "failed"],
      default: "generating",
    },

    error: {
      code: String,
      message: String,
    },

    editorState: {
      editedQuestionIds: {
        type: [String],
        default: [],
      },

      pinnedQuestionIds: {
        type: [String],
        default: [],
      },

      manualQuestionIds: {
        type: [String],
        default: [],
      },

      editedFlashcardIds: {
        type: [String],
        default: [],
      },

      pinnedFlashcardIds: {
        type: [String],
        default: [],
      },

      manualFlashcardIds: {
        type: [String],
        default: [],
      },
    },

    practice: {
      type: [PracticeSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

KitSchema.index({
  userId: 1,
  createdAt: -1,
});

export const Kit =
  mongoose.models.Kit ||
  mongoose.model<IKit>("Kit", KitSchema);