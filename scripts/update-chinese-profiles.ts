/**
 * 根据姓名更新中方人员扩展字段（UserChineseProfile）。
 * 仅更新扩展字段，不触碰基础字段。
 *
 * 用法：
 *   npx tsx scripts/update-chinese-profiles.ts
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

type RawMember = {
  name: string
  educationAndMajor?: string | null
  certifications?: string | null
  idNumber?: string | null
  passportNumber?: string | null
  birthplace?: string | null
  residenceInChina?: string | null
  domesticMobile?: string | null
  cumulativeAbroadYears?: string | number | null
  healthStatus?: string | null
  medicalHistory?: string | null
  redBookValidYears?: string | number | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
}

const prisma = new PrismaClient()

const rawMembers: RawMember[] = [
  {
    name: '杜钦',
    educationAndMajor: '长沙理工大学\n土木工程',
    certifications: '英语六级',
    idNumber: '430723199509125433',
    passportNumber: 'E75122902',
    birthplace: '湖南常德',
    residenceInChina: '湖南常德',
    domesticMobile: '18711138276',
    cumulativeAbroadYears: '9',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '1年',
    emergencyContactName: '杜梅芳',
    emergencyContactPhone: '15115636593',
  },
  {
    name: '刘晓杰',
    educationAndMajor: '陕西省宝鸡市交通技术学校、路桥专业',
    certifications: '/',
    idNumber: '610323198210276912',
    passportNumber: 'EJ4728911',
    birthplace: '陕西宝鸡',
    residenceInChina: '陕西宝鸡',
    domesticMobile: '15619187380',
    cumulativeAbroadYears: '10',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '/',
    emergencyContactName: '刘晓梅',
    emergencyContactPhone: '18202959910',
  },
  {
    name: '王栋',
    educationAndMajor: '西安电力机械制造公司机电学院',
    certifications: '',
    idNumber: '610122198709171418',
    passportNumber: 'PE0212781',
    birthplace: '陕西蓝田',
    residenceInChina: '陕西蓝田',
    domesticMobile: '17688469444',
    cumulativeAbroadYears: '5',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '/',
    emergencyContactName: '李静',
    emergencyContactPhone: '17620114789',
  },
  {
    name: '宋金泽',
    educationAndMajor: '汉寿一中',
    certifications: '',
    idNumber: '430722196906128937',
    passportNumber: 'EB4846099',
    birthplace: '湖南汉寿',
    residenceInChina: '湖南汉寿',
    domesticMobile: '13786681809',
    cumulativeAbroadYears: '18',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '',
    emergencyContactName: '杨凤娇',
    emergencyContactPhone: '13487917528',
  },
  {
    name: '王德雄',
    educationAndMajor: '东北财经大学',
    certifications: '二级建造师',
    idNumber: '51042119730324683x',
    passportNumber: 'EC8192917',
    birthplace: '四川绵阳',
    residenceInChina: '四川攀枝花',
    domesticMobile: '15881257518',
    cumulativeAbroadYears: '13',
    healthStatus: '健康',
    medicalHistory: '无病史',
    redBookValidYears: '1年',
    emergencyContactName: '陈丽',
    emergencyContactPhone: '13350557204',
  },
  {
    name: '张红权',
    educationAndMajor: '陕西省宝鸡市烹饪学院',
    certifications: '',
    idNumber: '61032419850316235X',
    passportNumber: 'EJ2095560',
    birthplace: '陕西宝鸡',
    residenceInChina: '陕西宝鸡',
    domesticMobile: '13679248533',
    cumulativeAbroadYears: '5',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '/',
    emergencyContactName: '胡苗苗',
    emergencyContactPhone: '15029574213',
  },
  {
    name: '廖鑫坤',
    educationAndMajor: '重庆交通工程\n物流管理',
    certifications: '中级经济师',
    idNumber: '430602199705102514',
    passportNumber: 'PE1907405',
    birthplace: '湖南岳阳',
    residenceInChina: '湖南岳阳',
    domesticMobile: '13762067397',
    cumulativeAbroadYears: '7',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '1年',
    emergencyContactName: '吴月凤',
    emergencyContactPhone: '18207308132',
  },
  {
    name: '赵泽广',
    educationAndMajor: '昆明理工大学\n土木工程',
    certifications: '市政二级建造师',
    idNumber: '532128199002077131',
    passportNumber: 'EH8070145',
    birthplace: '云南昭通',
    residenceInChina: '云南昭通',
    domesticMobile: '13099918898',
    cumulativeAbroadYears: '8',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '4年',
    emergencyContactName: '刘琴',
    emergencyContactPhone: '18313880332',
  },
  {
    name: '何柳琴',
    educationAndMajor: '四川旅游学院\n应用法语',
    certifications: '法语四级',
    idNumber: '510921199412281622',
    passportNumber: 'E81354833',
    birthplace: '四川遂宁',
    residenceInChina: '四川遂宁',
    domesticMobile: '18282568284',
    cumulativeAbroadYears: '7',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '2年',
    emergencyContactName: '杨清香',
    emergencyContactPhone: '19908049006',
  },
  {
    name: '邝东喜',
    educationAndMajor: '高中及以下',
    certifications: '',
    idNumber: '440783197807290815',
    passportNumber: 'E49342941',
    birthplace: '广东江门',
    residenceInChina: '广东开平',
    domesticMobile: '13828069068',
    cumulativeAbroadYears: '8',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '',
    emergencyContactName: '麦思昆',
    emergencyContactPhone: '13822315819',
  },
  {
    name: '李荣良',
    educationAndMajor: '高中及以下',
    certifications: '无',
    idNumber: '152629197211153018',
    passportNumber: 'EJ29699',
    birthplace: '内蒙古乌兰察布',
    residenceInChina: '内蒙古呼和浩特',
    domesticMobile: '13684719996',
    cumulativeAbroadYears: '6',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '5年',
    emergencyContactName: '张莲',
    emergencyContactPhone: '18006896609',
  },
  {
    name: '阳赣杰',
    educationAndMajor: '西安市38中',
    certifications: '',
    idNumber: '610102197211142337',
    passportNumber: 'EH3614924',
    birthplace: '江西南康',
    residenceInChina: '陕西西安',
    domesticMobile: '18192118160',
    cumulativeAbroadYears: '6',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '3年',
    emergencyContactName: '周媛',
    emergencyContactPhone: '13572891471',
  },
  {
    name: '高晓峰',
    educationAndMajor: '河南驻马店商业学校',
    certifications: '',
    idNumber: '412824198007213110',
    passportNumber: 'EJ3619042',
    birthplace: '河南驻马店',
    residenceInChina: '河南驻马店',
    domesticMobile: '18625331668',
    cumulativeAbroadYears: '3',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '/',
    emergencyContactName: '李改平',
    emergencyContactPhone: '17518811980',
  },
  {
    name: '姚国防',
    educationAndMajor: '长沙理工（公路与城市道路）',
    certifications: '/',
    idNumber: '410304197512022511',
    passportNumber: 'PE2193984',
    birthplace: '河南洛阳',
    residenceInChina: '河南洛阳',
    domesticMobile: '18903884891',
    cumulativeAbroadYears: '14',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '/',
    emergencyContactName: '王秀娟',
    emergencyContactPhone: '18137704148',
  },
  {
    name: '涂高',
    educationAndMajor: '广州开放大学\n建设工程管理',
    certifications: '',
    idNumber: '430722198804300715',
    passportNumber: 'EJ5707736',
    birthplace: '湖南常德',
    residenceInChina: '湖南常德',
    domesticMobile: '18670680225',
    cumulativeAbroadYears: '12',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '9',
    emergencyContactName: '张雨',
    emergencyContactPhone: '15115752702',
  },
  {
    name: '周泽华',
    educationAndMajor: '攀枝花市大田技校',
    certifications: '',
    idNumber: '510403197106032119',
    passportNumber: 'EJ2702333',
    birthplace: '四川攀枝花',
    residenceInChina: '重庆永川',
    domesticMobile: '15808106899',
    cumulativeAbroadYears: '8',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '',
    emergencyContactName: '陈国书',
    emergencyContactPhone: '15892564804',
  },
  {
    name: '舒均国',
    educationAndMajor: '长沙交通学院\n土木工程',
    certifications: '',
    idNumber: '510402197404153051',
    passportNumber: 'E88817923',
    birthplace: '四川攀枝花',
    residenceInChina: '四川攀枝花',
    domesticMobile: '15983594175',
    cumulativeAbroadYears: '22',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '',
    emergencyContactName: '刘琴',
    emergencyContactPhone: '15983596670',
  },
  {
    name: '甘星',
    educationAndMajor: '长沙理工大学\n土木工程',
    certifications: '/',
    idNumber: '430682199407297933',
    passportNumber: 'EL6191475',
    birthplace: '湖南岳阳',
    residenceInChina: '湖南岳阳',
    domesticMobile: '18373169844',
    cumulativeAbroadYears: '7',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '9年',
    emergencyContactName: '连竹兰',
    emergencyContactPhone: '15842867726',
  },
  {
    name: '黄美婷',
    educationAndMajor: '桂林理工大学 软件工程专业',
    certifications: '/',
    idNumber: '152122199612201823',
    passportNumber: 'EM8047365',
    birthplace: '内蒙古兴安盟',
    residenceInChina: '内蒙古呼伦贝尔',
    domesticMobile: '18658831220',
    cumulativeAbroadYears: '2',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '9年',
    emergencyContactName: '刘艳凤',
    emergencyContactPhone: '13941298484',
  },
  {
    name: '陈智',
    educationAndMajor: '广州港技工学校（汽车检测与维修）',
    certifications: '焊接与热切割作业',
    idNumber: '430723199007127834',
    passportNumber: 'EN1658735',
    birthplace: '湖南常德',
    residenceInChina: '湖南常德',
    domesticMobile: '15814327097',
    cumulativeAbroadYears: '1',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '10年',
    emergencyContactName: '邓子英',
    emergencyContactPhone: '15814327097',
  },
  {
    name: '涂明',
    educationAndMajor: '汉寿职业中等专业学校 建筑施工',
    certifications: '',
    idNumber: '430722198912040738',
    passportNumber: 'EP6672080',
    birthplace: '湖南常德',
    residenceInChina: '湖南常德',
    domesticMobile: '18157874378',
    cumulativeAbroadYears: '3',
    healthStatus: '良好',
    medicalHistory: '无',
    redBookValidYears: '10年',
    emergencyContactName: '谭欢',
    emergencyContactPhone: '13764835946',
  },
  {
    name: '谷峰',
    educationAndMajor: '中国地质大学土木工程',
    certifications: '/',
    idNumber: '131082198106230770',
    passportNumber: 'E64066571',
    birthplace: '天津',
    residenceInChina: '河北廊坊',
    domesticMobile: '18733635598',
    cumulativeAbroadYears: '16',
    healthStatus: '健康',
    medicalHistory: '无',
    redBookValidYears: '2027.9',
    emergencyContactName: '李红梅',
    emergencyContactPhone: '18031676029',
  },
  {
    name: '郑宝国',
    educationAndMajor: '长乐三中',
    certifications: '/',
    idNumber: '350126196903113433',
    passportNumber: 'EJ3618906',
    birthplace: '福建福州',
    residenceInChina: '福建福州',
    domesticMobile: '15394539519',
    cumulativeAbroadYears: '3',
    healthStatus: '健康',
    medicalHistory: '无',
    redBookValidYears: '7年',
    emergencyContactName: '郑培辉',
    emergencyContactPhone: '15394539519',
  },
]

const normalizeText = (value?: string | number | null) => {
  if (value === null || value === undefined) return null
  const trimmed = String(value).trim()
  if (!trimmed || trimmed === '/' || trimmed === '／') return null
  return trimmed
}

const normalizeMultiline = (value?: string | number | null) => {
  const text = normalizeText(value)
  if (!text) return null
  const stripped = text.replace(/^[\"“”]+|[\"“”]+$/g, '')
  return stripped.replace(/\s+/g, ' ').trim()
}

const normalizePhone = (value?: string | number | null) => {
  const text = normalizeText(value)
  if (!text) return null
  return text.replace(/\s+/g, '')
}

const normalizeCertifications = (value?: string | number | null) => {
  const text = normalizeText(value)
  if (!text) return []
  const emptyTokens = new Set(['无', '无证', '无证书', '暂无'])
  if (emptyTokens.has(text)) return []
  return text
    .split(/[\/,，;；、\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !emptyTokens.has(item))
}

type Warning = {
  name: string
  field: string
  value: string
}

const parseYearCount = (
  value: string | number | null | undefined,
  name: string,
  field: string,
  warnings: Warning[],
  max = 100,
) => {
  const text = normalizeText(value)
  if (!text) return null
  const match = text.match(/\d+/)
  if (!match) return null
  const parsed = Number.parseInt(match[0], 10)
  if (!Number.isFinite(parsed)) return null
  if (parsed > max) {
    warnings.push({ name, field, value: text })
    return null
  }
  return parsed
}

const buildProfileData = (member: RawMember, warnings: Warning[]) => ({
  idNumber: normalizeText(member.idNumber),
  passportNumber: normalizeText(member.passportNumber),
  educationAndMajor: normalizeMultiline(member.educationAndMajor),
  certifications: normalizeCertifications(member.certifications),
  domesticMobile: normalizePhone(member.domesticMobile),
  emergencyContactName: normalizeText(member.emergencyContactName),
  emergencyContactPhone: normalizePhone(member.emergencyContactPhone),
  redBookValidYears: parseYearCount(
    member.redBookValidYears ?? null,
    member.name,
    'redBookValidYears',
    warnings,
  ),
  cumulativeAbroadYears: parseYearCount(
    member.cumulativeAbroadYears ?? null,
    member.name,
    'cumulativeAbroadYears',
    warnings,
  ),
  birthplace: normalizeText(member.birthplace),
  residenceInChina: normalizeText(member.residenceInChina),
  medicalHistory: normalizeText(member.medicalHistory),
  healthStatus: normalizeText(member.healthStatus),
})

const main = async () => {
  const updated: Array<{ id: number; name: string; username: string }> = []
  const missing: string[] = []
  const duplicates: Array<{ name: string; count: number; usernames: string[] }> = []
  const warnings: Warning[] = []

  for (const member of rawMembers) {
    const users = await prisma.user.findMany({
      where: { name: member.name },
      select: { id: true, username: true, name: true },
    })
    if (users.length === 0) {
      missing.push(member.name)
      continue
    }
    if (users.length > 1) {
      duplicates.push({
        name: member.name,
        count: users.length,
        usernames: users.map((user) => user.username),
      })
      continue
    }
    const user = users[0]
    const profileData = buildProfileData(member, warnings)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        chineseProfile: {
          upsert: {
            create: profileData,
            update: profileData,
          },
        },
      },
    })

    updated.push({ id: user.id, name: member.name, username: user.username })
  }

  console.log(`已更新 ${updated.length} 名成员的中方扩展字段。`)
  if (missing.length) {
    console.log('未匹配到的姓名：', missing.join('、'))
  }
  if (duplicates.length) {
    console.log('存在重名，已跳过以下姓名：')
    duplicates.forEach((item) => {
      console.log(`- ${item.name}（${item.count} 条）：${item.usernames.join(', ')}`)
    })
  }
  if (warnings.length) {
    console.log('以下字段值超出合理范围，已跳过（建议人工确认）：')
    warnings.forEach((warning) => {
      console.log(`- ${warning.name} ${warning.field}: ${warning.value}`)
    })
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
