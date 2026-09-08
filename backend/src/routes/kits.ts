import { Router } from "express";
import { z } from "zod";

import { Kit } from "../models/Kit";
import {
  requireAuth,
  type AuthRequest,
} from "../middleware/auth";

import { runPipeline } from "../pipeline/runPipeline";

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

export default router;