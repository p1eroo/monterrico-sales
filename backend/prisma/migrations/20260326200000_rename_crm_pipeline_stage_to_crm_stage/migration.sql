-- RenameTable
ALTER TABLE "CrmPipelineStage" RENAME TO "CrmStage";

-- RenameIndex
ALTER INDEX "CrmPipelineStage_pkey" RENAME TO "CrmStage_pkey";
ALTER INDEX "CrmPipelineStage_slug_key" RENAME TO "CrmStage_slug_key";
