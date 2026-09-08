import { Router } from "express";
import { z } from "zod";

import { Kit } from "../models/Kit";
import {
  requireAuth,
  type AuthRequest,
} from "../middleware/auth";

import { runPipeline } from "../pipeline/runPipeline";
import { generateQuestionsForCategory } from "../pipeline/generateQuestions";
import { buildSchedule } from "../pipeline/schedule";
import { findUncoveredRequirements } from "../pipeline/coverage";

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

      const generatedKit =
        await runPipeline({
          jd,
          company_url,
          days,
        });

      const savedKit =
        await Kit.create({
          userId: req.user!.id,

          input: {
            jd,
            companyUrl: company_url,
            days,
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

      return res.status(201).json({
        success: true,

        kit: {
          id: savedKit._id,
          status: savedKit.status,
          data: savedKit.kit,
          createdAt: savedKit.createdAt,
        },
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
          (id) => id !== req.params.questionId
        );

      kitDocument.editorState.manualQuestionIds =
        kitDocument.editorState.manualQuestionIds.filter(
          (id) => id !== req.params.questionId
        );

      kitDocument.editorState.pinnedQuestionIds =
        kitDocument.editorState.pinnedQuestionIds.filter(
          (id) => id !== req.params.questionId
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

export default router;