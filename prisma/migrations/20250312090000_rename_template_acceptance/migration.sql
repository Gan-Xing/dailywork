-- 纠正验收内容文案：模版安装验收 -> 模板安装验收
DO $$
DECLARE
  old_id INT;
  new_id INT;
BEGIN
  SELECT "id" INTO new_id FROM "CheckDefinition" WHERE "name" = '模板安装验收';
  SELECT "id" INTO old_id FROM "CheckDefinition" WHERE "name" = '模版安装验收';

  IF old_id IS NULL THEN
    -- 无需处理
    RETURN;
  END IF;

  IF new_id IS NULL THEN
    -- 直接改名
    UPDATE "CheckDefinition"
    SET "name" = '模板安装验收',
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = old_id;
  ELSE
    -- 目标已存在，重指向关联表后删除旧项
    UPDATE "PhaseDefinitionCheck"
    SET "checkDefinitionId" = new_id
    WHERE "checkDefinitionId" = old_id;

    UPDATE "RoadPhaseCheck"
    SET "checkDefinitionId" = new_id
    WHERE "checkDefinitionId" = old_id;

    DELETE FROM "CheckDefinition" WHERE "id" = old_id;
  END IF;
END $$;

UPDATE "InspectionRequest"
SET "checks" = (
  SELECT array_agg(
    CASE WHEN elem = '模版安装验收' THEN '模板安装验收' ELSE elem END
    ORDER BY ord
  )
  FROM unnest("checks") WITH ORDINALITY AS t(elem, ord)
)
WHERE '模版安装验收' = ANY("checks");
