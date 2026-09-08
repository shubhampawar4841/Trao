import { Router } from "express";
import { z } from "zod";

import { Kit } from "../models/Kit";
import {
  requireAuth,
  type AuthRequest,
} from "../middleware/auth";

import { runPipeline } from "../pipeline/runPipeline";
import { generateQuestionsForCategory } from "../pipeline/generateQuestions";

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
export default router;