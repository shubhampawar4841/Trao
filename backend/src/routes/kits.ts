import { Router } from "express";
import { z } from "zod";

import { Kit, type IKit } from "../models/Kit";

type PracticeItem = IKit["practice"][number];
import {
  requireAuth,
  type AuthRequest,
} from "../middleware/auth";

import { runPipeline } from "../pipeline/runPipeline";
import { generateQuestionsForCategory } from "../pipeline/generateQuestions";
import { buildSchedule } from "../pipeline/schedule";
import { findUncoveredRequirements } from "../pipeline/coverage";
import { crawlCompany } from "../pipeline/crawlCompany";
import { generateCompanyBrief } from "../pipeline/generateCompanyBrief";

const router = Router();

const CreateKitSchema = z.object({
  jd: z
    .string()
    .trim()
    .min(1, "Job description is required"),

  company_url: z
    .string()
    .trim()
    .url("Valid company URL is required"),

  days: z
    .number()
    .int()
    .min(1)
    .max(60),
});

type CreateKitInput = z.infer<
  typeof CreateKitSchema
>;

async function generateAndSaveKit(
  userId: string,
  input: CreateKitInput
) {
  const { kit: generatedKit, diagnostics } =
    await runPipeline({
      jd: input.jd,
      company_url: input.company_url,
      days: input.days,
    });

  const savedKit = await Kit.create({
    userId,

    input: {
      jd: input.jd,
      companyUrl:
        input.company_url,
      days: input.days,
    },

    kit: generatedKit,

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

  return {
    savedKit,
    diagnostics,
  };
}

const BatchCaseSchema =
  CreateKitSchema.extend({
    id: z
      .string()
      .trim()
      .min(1)
      .max(100),
  });

const BatchCreateSchema = z.object({
  cases: z
    .array(BatchCaseSchema)
    .min(1)
    .max(
      10,
      "Maximum 10 roles per batch"
    ),
});

/**
 * POST /api/kits
 *
 * Generate and save a new interview kit.
 */
router.post(
  "/",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const parsed =
        CreateKitSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid input",
          errors: parsed.error.flatten(),
        });
      }

      const {
        jd,
        company_url,
        days,
      } = parsed.data;

      console.log(
        `Generating kit for user ${req.user!.id}`
      );

      const { savedKit, diagnostics } =
        await generateAndSaveKit(
          req.user!.id,
          {
            jd,
            company_url,
            days,
          }
        );

      return res.status(201).json({
        success: true,

        kit: {
          id: savedKit._id,
          status: savedKit.status,
          data: savedKit.kit,
          createdAt: savedKit.createdAt,
        },

        diagnostics,
      });
    } catch (error) {
      console.error(
        "Create kit error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not generate interview kit",
      });
    }
  }
);

/**
 * POST /api/kits/batch
 *
 * Generate multiple interview kits.
 *
 * Cases run sequentially to avoid
 * overwhelming free-tier LLM/scraping
 * rate limits.
 *
 * One failed case does not abort
 * the rest of the batch.
 */
router.post(
  "/batch",
  requireAuth,
  async (
    req: AuthRequest,
    res
  ) => {
    const parsed =
      BatchCreateSchema.safeParse(
        req.body
      );

    if (!parsed.success) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Invalid batch input",
          errors:
            parsed.error.flatten(),
        });
    }

    const cases =
      parsed.data.cases;

    const ids = cases.map(
      (item) => item.id
    );

    if (
      new Set(ids).size !==
      ids.length
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Every batch case must have a unique id",
        });
    }

    const results: Array<{
      id: string;
      status: "ok" | "failed";
      kitId: string | null;
      error: {
        code?: string;
        message: string;
      } | null;
    }> = [];

    for (const item of cases) {
      try {
        console.log(
          `Batch: generating ${item.id} for user ${req.user!.id}`
        );

        const savedKit =
          await generateAndSaveKit(
            req.user!.id,
            {
              jd: item.jd,
              company_url:
                item.company_url,
              days: item.days,
            }
          );

        results.push({
          id: item.id,
          status: "ok",

          kitId:
            savedKit.savedKit._id.toString(),

          error: null,
        });
      } catch (error) {
        console.error(
          `Batch case ${item.id} failed:`,
          error
        );

        results.push({
          id: item.id,
          status: "failed",
          kitId: null,

          error: {
            message:
              error instanceof Error
                ? error.message
                : "Could not generate interview kit",
          },
        });
      }
    }

    const successful =
      results.filter(
        (result) =>
          result.status === "ok"
      ).length;

    return res.json({
      success: true,

      summary: {
        total: results.length,
        successful,
        failed:
          results.length -
          successful,
      },

      results,
    });
  }
);

/**
 * GET /api/kits
 * List kits belonging to logged-in user.
 */
router.get(
    "/",
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const kits = await Kit.find({
          userId: req.user!.id,
        })
          .sort({ createdAt: -1 })
          .select(
            "_id status input kit.source createdAt updatedAt"
          );
  
        return res.json({
          success: true,
          kits,
        });
      } catch (error) {
        console.error("List kits error:", error);
  
        return res.status(500).json({
          success: false,
          message: "Could not load kits",
        });
      }
    }
  );
  
  /**
   * GET /api/kits/:id
   * Open one saved kit.
   */
  router.get(
    "/:id",
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const kit = await Kit.findOne({
          _id: req.params.id,
          userId: req.user!.id,
        });
  
        if (!kit) {
          return res.status(404).json({
            success: false,
            message: "Kit not found",
          });
        }
  
        return res.json({
          success: true,
          kit,
        });
      } catch (error) {
        console.error("Get kit error:", error);
  
        return res.status(500).json({
          success: false,
          message: "Could not load kit",
        });
      }
    }
  );

const AddQuestionSchema = z.object({
  prompt: z.string().trim().min(1),
  answer_outline: z.string().trim().min(1),

  category: z.enum([
    "technical",
    "behavioural",
    "system-design",
    "company-fit",
  ]),

  difficulty: z.number().int().min(1).max(3),

  requirement_ids: z.array(z.string()).default([]),
});

router.post(
  "/:id/questions",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const parsed = AddQuestionSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid question",
          errors: parsed.error.flatten(),
        });
      }

      const kitDocument = await Kit.findOne({
        _id: req.params.id,
        userId: req.user!.id,
      });

      if (!kitDocument) {
        return res.status(404).json({
          success: false,
          message: "Kit not found",
        });
      }

      const kitData = kitDocument.kit as any;

      const existingNumbers = kitData.questions
        .map((q: any) => {
          const match = q.id.match(/^q(\d+)$/);
          return match ? Number(match[1]) : 0;
        });

      const nextNumber =
        Math.max(0, ...existingNumbers) + 1;

      const question = {
        id: `q${nextNumber}`,
        ...parsed.data,
      };

      kitData.questions.push(question);

      kitDocument.editorState.manualQuestionIds.push(
        question.id
      );

      kitDocument.markModified("kit");
      kitDocument.markModified("editorState");

      await kitDocument.save();

      return res.status(201).json({
        success: true,
        question,
        editorState: kitDocument.editorState,
      });
    } catch (error) {
      console.error("Add question error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not add question",
      });
    }
  }
);

  const UpdateQuestionSchema = z.object({
    prompt: z.string().trim().min(1).optional(),
    answer_outline: z.string().trim().min(1).optional(),
  
    category: z
      .enum([
        "technical",
        "behavioural",
        "system-design",
        "company-fit",
      ])
      .optional(),
  
    difficulty: z
      .number()
      .int()
      .min(1)
      .max(3)
      .optional(),
  });
  
  /**
   * PATCH /api/kits/:id/questions/:questionId
   */
  router.patch(
    "/:id/questions/:questionId",
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const parsed = UpdateQuestionSchema.safeParse(
          req.body
        );
  
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            message: "Invalid question update",
            errors: parsed.error.flatten(),
          });
        }
  
        const kitDocument = await Kit.findOne({
          _id: req.params.id,
          userId: req.user!.id,
        });
  
        if (!kitDocument) {
          return res.status(404).json({
            success: false,
            message: "Kit not found",
          });
        }
  
        const kitData = kitDocument.kit as any;
  
        const question = kitData.questions?.find(
          (q: any) =>
            q.id === req.params.questionId
        );
  
        if (!question) {
          return res.status(404).json({
            success: false,
            message: "Question not found",
          });
        }
  
        Object.assign(
          question,
          parsed.data
        );
  
        if (
          !kitDocument.editorState.editedQuestionIds.includes(
            req.params.questionId
          )
        ) {
          kitDocument.editorState.editedQuestionIds.push(
            req.params.questionId
          );
        }
  
        kitDocument.markModified("kit");
        kitDocument.markModified("editorState");
  
        await kitDocument.save();
  
        return res.json({
          success: true,
          question,
          editorState:
            kitDocument.editorState,
        });
      } catch (error) {
        console.error(
          "Update question error:",
          error
        );
  
        return res.status(500).json({
          success: false,
          message: "Could not update question",
        });
      }
    }
  );

  const CategorySchema = z.enum([
    "technical",
    "behavioural",
    "system-design",
    "company-fit",
  ]);
  
  /**
   * POST /api/kits/:id/regenerate/questions/:category
   *
   * Regenerates only untouched questions in one category.
   * Edited/manual/pinned questions survive.
   */
  router.post(
    "/:id/regenerate/questions/:category",
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const categoryResult = CategorySchema.safeParse(
          req.params.category
        );
  
        if (!categoryResult.success) {
          return res.status(400).json({
            success: false,
            message: "Invalid question category",
          });
        }
  
        const category = categoryResult.data;
  
        const kitDocument = await Kit.findOne({
          _id: req.params.id,
          userId: req.user!.id,
        });
  
        if (!kitDocument) {
          return res.status(404).json({
            success: false,
            message: "Kit not found",
          });
        }
  
        const kitData = kitDocument.kit as any;
  
        const protectedIds = new Set([
          ...kitDocument.editorState.editedQuestionIds,
          ...kitDocument.editorState.manualQuestionIds,
          ...kitDocument.editorState.pinnedQuestionIds,
        ]);
  
        const categoryQuestions =
          kitData.questions.filter(
            (q: any) => q.category === category
          );
  
        const replaceableQuestions =
          categoryQuestions.filter(
            (q: any) => !protectedIds.has(q.id)
          );
  
        // Nothing to regenerate.
        if (replaceableQuestions.length === 0) {
          return res.json({
            success: true,
            message:
              "All questions in this category are protected",
            questions: categoryQuestions,
          });
        }
  
        const generated =
          await generateQuestionsForCategory({
            requirements: kitData.role.requirements,
            companyBrief: kitData.company_brief,
            category,
          });
  
        /*
         * Keep existing IDs so schedule references remain valid.
         * Example:
         * old q2 -> regenerated content still uses q2
         */
        const replacements = replaceableQuestions.map(
          (oldQuestion: any, index: number) => {
            const newQuestion = generated[index];
  
            // If model generated fewer questions,
            // retain the old one instead of deleting it.
            if (!newQuestion) {
              return oldQuestion;
            }
  
            return {
              ...newQuestion,
              id: oldQuestion.id,
            };
          }
        );
  
        const replacementMap = new Map(
          replacements.map((q: any) => [q.id, q])
        );
  
        kitData.questions = kitData.questions.map(
          (question: any) =>
            replacementMap.get(question.id) ??
            question
        );
  
        kitDocument.markModified("kit");
  
        await kitDocument.save();
  
        return res.json({
          success: true,
          category,
          preserved_question_ids:
            categoryQuestions
              .filter((q: any) =>
                protectedIds.has(q.id)
              )
              .map((q: any) => q.id),
  
          regenerated_question_ids:
            replaceableQuestions.map(
              (q: any) => q.id
            ),
  
          questions:
            kitData.questions.filter(
              (q: any) =>
                q.category === category
            ),
        });
      } catch (error) {
        console.error(
          "Regenerate category error:",
          error
        );
  
        return res.status(500).json({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Could not regenerate category",
        });
      }
    }
  );

/**
 * DELETE /api/kits/:id/questions/:questionId
 */
router.delete(
  "/:id/questions/:questionId",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const kitDocument = await Kit.findOne({
        _id: req.params.id,
        userId: req.user!.id,
      });

      if (!kitDocument) {
        return res.status(404).json({
          success: false,
          message: "Kit not found",
        });
      }

      const kitData = kitDocument.kit as any;

      const questionIndex =
        kitData.questions.findIndex(
          (q: any) =>
            q.id === req.params.questionId
        );

      if (questionIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Question not found",
        });
      }

      const [deletedQuestion] =
        kitData.questions.splice(
          questionIndex,
          1
        );

      // Remove state references
      kitDocument.editorState.editedQuestionIds =
        kitDocument.editorState.editedQuestionIds.filter(
          (id: string) => id !== req.params.questionId
        );

      kitDocument.editorState.manualQuestionIds =
        kitDocument.editorState.manualQuestionIds.filter(
          (id: string) => id !== req.params.questionId
        );

      kitDocument.editorState.pinnedQuestionIds =
        kitDocument.editorState.pinnedQuestionIds.filter(
          (id: string) => id !== req.params.questionId
        );

      // Recalculate coverage
      kitData.coverage.uncovered_requirement_ids =
        findUncoveredRequirements(
          kitData.role.requirements,
          kitData.questions
        );

      // Rebuild schedule so deleted IDs cannot remain
      kitData.schedule = buildSchedule(
        kitData.role.requirements,
        kitData.questions,
        kitData.schedule.days_available
      );

      kitDocument.markModified("kit");
      kitDocument.markModified("editorState");

      await kitDocument.save();

      return res.json({
        success: true,
        deleted_question_id:
          deletedQuestion.id,
        coverage:
          kitData.coverage,
        schedule:
          kitData.schedule,
      });
    } catch (error) {
      console.error(
        "Delete question error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not delete question",
      });
    }
  }
);

const ReorderQuestionsSchema = z.object({
  question_ids: z.array(z.string()).min(1),
});

/**
 * PATCH /api/kits/:id/question-order
 */
router.patch(
  "/:id/question-order",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const parsed = ReorderQuestionsSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid question order",
          errors: parsed.error.flatten(),
        });
      }

      const kitDocument = await Kit.findOne({
        _id: req.params.id,
        userId: req.user!.id,
      });

      if (!kitDocument) {
        return res.status(404).json({
          success: false,
          message: "Kit not found",
        });
      }

      const kitData = kitDocument.kit as any;
      const currentQuestions = kitData.questions;

      const currentIds = currentQuestions.map(
        (q: any) => q.id
      );

      const requestedIds = parsed.data.question_ids;

      // Must contain every current question exactly once
      if (
        requestedIds.length !== currentIds.length ||
        new Set(requestedIds).size !== requestedIds.length ||
        currentIds.some(
          (id: string) => !requestedIds.includes(id)
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "question_ids must contain every existing question exactly once",
        });
      }

      const questionMap = new Map(
        currentQuestions.map((q: any) => [
          q.id,
          q,
        ])
      );

      kitData.questions = requestedIds.map(
        (id) => questionMap.get(id)
      );

      kitDocument.markModified("kit");

      await kitDocument.save();

      return res.json({
        success: true,
        question_ids: kitData.questions.map(
          (q: any) => q.id
        ),
      });
    } catch (error) {
      console.error(
        "Reorder questions error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Could not reorder questions",
      });
    }
  }
);

const UpdateFlashcardSchema = z.object({
  front: z.string().trim().min(1).optional(),
  back: z.string().trim().min(1).optional(),
});

/**
 * PATCH /api/kits/:id/flashcards/:flashcardId
 */
router.patch(
  "/:id/flashcards/:flashcardId",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const parsed = UpdateFlashcardSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid flashcard update",
          errors: parsed.error.flatten(),
        });
      }

      const kitDocument = await Kit.findOne({
        _id: req.params.id,
        userId: req.user!.id,
      });

      if (!kitDocument) {
        return res.status(404).json({
          success: false,
          message: "Kit not found",
        });
      }

      const kitData = kitDocument.kit as any;

      const flashcard = kitData.flashcards.find(
        (f: any) =>
          f.id === req.params.flashcardId
      );

      if (!flashcard) {
        return res.status(404).json({
          success: false,
          message: "Flashcard not found",
        });
      }

      Object.assign(
        flashcard,
        parsed.data
      );

      if (
        !kitDocument.editorState.editedFlashcardIds.includes(
          req.params.flashcardId
        )
      ) {
        kitDocument.editorState.editedFlashcardIds.push(
          req.params.flashcardId
        );
      }

      kitDocument.markModified("kit");
      kitDocument.markModified("editorState");

      await kitDocument.save();

      return res.json({
        success: true,
        flashcard,
        editorState:
          kitDocument.editorState,
      });
    } catch (error) {
      console.error(
        "Update flashcard error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Could not update flashcard",
      });
    }
  }
);

const AddFlashcardSchema = z.object({
  front: z.string().trim().min(1),
  back: z.string().trim().min(1),
  requirement_ids: z.array(z.string()).default([]),
});

/**
 * POST /api/kits/:id/flashcards
 */
router.post(
  "/:id/flashcards",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const parsed = AddFlashcardSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid flashcard",
          errors: parsed.error.flatten(),
        });
      }

      const kitDocument = await Kit.findOne({
        _id: req.params.id,
        userId: req.user!.id,
      });

      if (!kitDocument) {
        return res.status(404).json({
          success: false,
          message: "Kit not found",
        });
      }

      const kitData = kitDocument.kit as any;

      const existingNumbers = kitData.flashcards.map(
        (f: any) => {
          const match = f.id.match(/^f(\d+)$/);
          return match ? Number(match[1]) : 0;
        }
      );

      const nextNumber =
        Math.max(0, ...existingNumbers) + 1;

      const flashcard = {
        id: `f${nextNumber}`,
        ...parsed.data,
      };

      kitData.flashcards.push(flashcard);

      kitDocument.editorState.manualFlashcardIds.push(
        flashcard.id
      );

      kitDocument.markModified("kit");
      kitDocument.markModified("editorState");

      await kitDocument.save();

      return res.status(201).json({
        success: true,
        flashcard,
        editorState: kitDocument.editorState,
      });
    } catch (error) {
      console.error("Add flashcard error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not add flashcard",
      });
    }
  }
);

/**
 * DELETE /api/kits/:id/flashcards/:flashcardId
 */
router.delete(
  "/:id/flashcards/:flashcardId",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const kitDocument = await Kit.findOne({
        _id: req.params.id,
        userId: req.user!.id,
      });

      if (!kitDocument) {
        return res.status(404).json({
          success: false,
          message: "Kit not found",
        });
      }

      const kitData = kitDocument.kit as any;

      const index = kitData.flashcards.findIndex(
        (f: any) =>
          f.id === req.params.flashcardId
      );

      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: "Flashcard not found",
        });
      }

      const [deleted] = kitData.flashcards.splice(
        index,
        1
      );

      kitDocument.editorState.editedFlashcardIds =
        kitDocument.editorState.editedFlashcardIds.filter(
          (id: string) => id !== req.params.flashcardId
        );

      kitDocument.editorState.manualFlashcardIds =
        kitDocument.editorState.manualFlashcardIds.filter(
          (id: string) => id !== req.params.flashcardId
        );

      kitDocument.editorState.pinnedFlashcardIds =
        kitDocument.editorState.pinnedFlashcardIds.filter(
          (id: string) => id !== req.params.flashcardId
        );

      kitDocument.markModified("kit");
      kitDocument.markModified("editorState");

      await kitDocument.save();

      return res.json({
        success: true,
        deleted_flashcard_id: deleted.id,
      });
    } catch (error) {
      console.error("Delete flashcard error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not delete flashcard",
      });
    }
  }
);

const UpdateCompanyBriefSchema = z.object({
  summary: z.string().trim().min(1).optional(),
  what_they_do: z.string().trim().min(1).optional(),
});

/**
 * PATCH /api/kits/:id/company-brief
 */
router.patch(
  "/:id/company-brief",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const parsed = UpdateCompanyBriefSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid company brief update",
          errors: parsed.error.flatten(),
        });
      }

      const kitDocument = await Kit.findOne({
        _id: req.params.id,
        userId: req.user!.id,
      });

      if (!kitDocument) {
        return res.status(404).json({
          success: false,
          message: "Kit not found",
        });
      }

      const kitData = kitDocument.kit as any;

      Object.assign(
        kitData.company_brief,
        parsed.data
      );

      kitDocument.markModified("kit");

      await kitDocument.save();

      return res.json({
        success: true,
        company_brief: kitData.company_brief,
      });
    } catch (error) {
      console.error("Update company brief error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not update company brief",
      });
    }
  }
);

/**
 * POST /api/kits/:id/regenerate/company-brief
 */
router.post(
  "/:id/regenerate/company-brief",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const kitDocument = await Kit.findOne({
        _id: req.params.id,
        userId: req.user!.id,
      });

      if (!kitDocument) {
        return res.status(404).json({
          success: false,
          message: "Kit not found",
        });
      }

      const kitData = kitDocument.kit as any;

      // Public API remains protected against private URLs.
      const crawl = await crawlCompany(
        kitData.source.company_url
      );

      const companyBrief =
        await generateCompanyBrief(crawl);

      // Replace ONLY company brief.
      kitData.company_brief = companyBrief;

      // Refresh research metadata.
      kitData.source.pages_used = [
        crawl.homepage.url,
        ...crawl.pages.map((page) => page.url),
      ];

      kitData.source.researched_at =
        new Date().toISOString();

      kitDocument.markModified("kit");

      await kitDocument.save();

      return res.json({
        success: true,
        company_brief: kitData.company_brief,
        pages_used: kitData.source.pages_used,
      });
    } catch (error) {
      console.error(
        "Regenerate company brief error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not regenerate company brief",
      });
    }
  }
);

const RegenerateScheduleSchema = z.object({
  days: z.number().int().min(1).max(60).optional(),
});

/**
 * POST /api/kits/:id/regenerate/schedule
 */
router.post(
  "/:id/regenerate/schedule",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const parsed = RegenerateScheduleSchema.safeParse(
        req.body ?? {}
      );

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid schedule options",
          errors: parsed.error.flatten(),
        });
      }

      const kitDocument = await Kit.findOne({
        _id: req.params.id,
        userId: req.user!.id,
      });

      if (!kitDocument) {
        return res.status(404).json({
          success: false,
          message: "Kit not found",
        });
      }

      const kitData = kitDocument.kit as any;

      const days =
        parsed.data.days ??
        kitData.schedule.days_available;

      kitData.schedule = buildSchedule(
        kitData.role.requirements,
        kitData.questions,
        days
      );

      kitDocument.input.days = days;

      kitDocument.markModified("kit");
      kitDocument.markModified("input");

      await kitDocument.save();

      return res.json({
        success: true,
        schedule: kitData.schedule,
      });
    } catch (error) {
      console.error(
        "Regenerate schedule error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Could not regenerate schedule",
      });
    }
  }
);

const PracticeUpdateSchema = z.object({
  confidence: z.number().int().min(1).max(3),
  covered: z.boolean(),
});

/**
 * PATCH /api/kits/:id/practice/:flashcardId
 */
router.patch(
  "/:id/practice/:flashcardId",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const parsed = PracticeUpdateSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid practice update",
          errors: parsed.error.flatten(),
        });
      }

      const kitDocument = await Kit.findOne({
        _id: req.params.id,
        userId: req.user!.id,
      });

      if (!kitDocument) {
        return res.status(404).json({
          success: false,
          message: "Kit not found",
        });
      }

      const kitData = kitDocument.kit as any;

      const flashcardExists = kitData.flashcards.some(
        (f: any) =>
          f.id === req.params.flashcardId
      );

      if (!flashcardExists) {
        return res.status(404).json({
          success: false,
          message: "Flashcard not found",
        });
      }

      let practiceItem =
        kitDocument.practice.find(
          (item: PracticeItem) =>
            item.flashcardId ===
            req.params.flashcardId
        );

      if (!practiceItem) {
        kitDocument.practice.push({
          flashcardId:
            req.params.flashcardId,
          confidence:
            parsed.data.confidence,
          covered:
            parsed.data.covered,
          timesReviewed: 1,
          lastPracticedAt:
            new Date(),
        });

        practiceItem =
          kitDocument.practice[
            kitDocument.practice.length - 1
          ];
      } else {
        practiceItem.confidence =
          parsed.data.confidence;

        practiceItem.covered =
          parsed.data.covered;

        practiceItem.timesReviewed += 1;

        practiceItem.lastPracticedAt =
          new Date();
      }

      kitDocument.markModified("practice");

      await kitDocument.save();

      return res.json({
        success: true,
        practice: practiceItem,
      });
    } catch (error) {
      console.error(
        "Practice update error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not update practice progress",
      });
    }
  }
);

/**
 * GET /api/kits/:id/practice
 *
 * Returns flashcards ordered:
 * 1. Never reviewed
 * 2. Lowest confidence first
 * 3. Uncovered before covered
 */
router.get(
  "/:id/practice",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const kitDocument = await Kit.findOne({
        _id: req.params.id,
        userId: req.user!.id,
      });

      if (!kitDocument) {
        return res.status(404).json({
          success: false,
          message: "Kit not found",
        });
      }

      const kitData = kitDocument.kit as any;

      const practiceMap = new Map<string, PracticeItem>(
        kitDocument.practice.map((item: PracticeItem) => [
          item.flashcardId,
          item,
        ])
      );

      const flashcards = kitData.flashcards.map(
        (flashcard: any) => {
          const progress = practiceMap.get(
            flashcard.id
          );

          return {
            ...flashcard,

            practice: progress
              ? {
                  confidence:
                    progress.confidence,
                  covered:
                    progress.covered,
                  timesReviewed:
                    progress.timesReviewed,
                  lastPracticedAt:
                    progress.lastPracticedAt,
                }
              : {
                  confidence: 0,
                  covered: false,
                  timesReviewed: 0,
                  lastPracticedAt: null,
                },
          };
        }
      );

      flashcards.sort((a: any, b: any) => {
        // Never reviewed first
        if (
          a.practice.timesReviewed === 0 &&
          b.practice.timesReviewed > 0
        ) {
          return -1;
        }

        if (
          b.practice.timesReviewed === 0 &&
          a.practice.timesReviewed > 0
        ) {
          return 1;
        }

        // Least confidence first
        if (
          a.practice.confidence !==
          b.practice.confidence
        ) {
          return (
            a.practice.confidence -
            b.practice.confidence
          );
        }

        // Uncovered before covered
        if (
          a.practice.covered !==
          b.practice.covered
        ) {
          return a.practice.covered ? 1 : -1;
        }

        return 0;
      });

      return res.json({
        success: true,

        stats: {
          total: flashcards.length,

          reviewed: flashcards.filter(
            (f: any) =>
              f.practice.timesReviewed > 0
          ).length,

          covered: flashcards.filter(
            (f: any) =>
              f.practice.covered
          ).length,
        },

        flashcards,
      });
    } catch (error) {
      console.error(
        "Practice queue error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not load practice session",
      });
    }
  }
);

export default router;