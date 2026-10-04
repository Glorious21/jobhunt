// Keyword vocabulary used for skill extraction and CV ↔ job matching.
const SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'React Native', 'Next.js', 'Vue', 'Angular', 'Svelte',
  'Node.js', 'Express', 'NestJS', 'Python', 'Django', 'Flask', 'FastAPI', 'Java', 'Spring',
  'Kotlin', 'Swift', 'Go', 'Rust', 'C++', 'C#', '.NET', 'PHP', 'Laravel', 'Ruby', 'Rails',
  'HTML', 'CSS', 'Sass', 'Tailwind', 'GraphQL', 'REST', 'gRPC', 'WebSockets',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Kafka', 'RabbitMQ', 'Prisma', 'SQL',
  'Docker', 'Kubernetes', 'Terraform', 'AWS', 'GCP', 'Azure', 'Vercel', 'Linux',
  'CI/CD', 'GitHub Actions', 'Git', 'Jest', 'Vitest', 'Cypress', 'Playwright', 'Testing',
  'Microservices', 'System Design', 'Distributed Systems', 'Performance', 'Accessibility', 'Security',
  'Machine Learning', 'PyTorch', 'TensorFlow', 'Pandas', 'Data Analysis', 'LLM',
  'Figma', 'UI/UX', 'Design systems', 'Prototyping', 'Wireframing', 'User research', 'Usability testing',
  'Interaction design', 'Visual design', 'Motion design', 'A/B testing', 'Information architecture',
  'Workshops', 'Data viz', 'HTML/CSS', 'Sketch', 'Framer', 'Webflow',
  'Agile', 'Scrum', 'Leadership', 'Mentoring',
  'Product Management', 'Product strategy', 'Communication', 'Stakeholder Management',
]

function pattern(skill: string) {
  const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i')
}

const PATTERNS = SKILLS.map((s) => [s, pattern(s)] as const)

export function extractSkills(text: string): string[] {
  if (!text) return []
  const lower = text.toLowerCase()
  const found = PATTERNS.filter(([, re]) => re.test(lower)).map(([s]) => s)
  // Drop a skill that only appears as part of a longer match ("Testing" inside "A/B testing").
  return found.filter((s) => {
    const occurrences = lower.split(s.toLowerCase()).length - 1
    const inside = found
      .filter((t) => t !== s && t.toLowerCase().includes(s.toLowerCase()))
      .reduce((n, t) => n + lower.split(t.toLowerCase()).length - 1, 0)
    return occurrences > inside
  })
}

/** Keyword overlap between a CV and a job description. */
export function compareSkills(cvText: string, jobText: string) {
  const cv = new Set(extractSkills(cvText))
  const job = extractSkills(jobText)
  const matching = job.filter((s) => cv.has(s))
  const missing = job.filter((s) => !cv.has(s))
  const score = job.length ? Math.round((matching.length / job.length) * 100) : 0
  return { matching, missing, score, jobSkillCount: job.length, cvSkills: [...cv] }
}
