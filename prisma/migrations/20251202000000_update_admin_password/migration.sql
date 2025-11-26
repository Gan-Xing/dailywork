-- Update default admin password to Admin888
UPDATE "User"
SET "passwordHash" = '777d65a0bba832405f89e63213931d83:bc72164f23eb640b4da33b8c748ba0569f199b788595e03ec7317813af918d873c46602a708ae06b9b0fbd6ee0bdbd8b6a2516deddfbce5d159f62218e1ff9d9',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "username" = 'GanXing';
