-- Add priority/importance/difficulty to roadmap ideas
ALTER TABLE "RoadmapIdea"
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "importance" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "difficulty" INTEGER NOT NULL DEFAULT 3;
