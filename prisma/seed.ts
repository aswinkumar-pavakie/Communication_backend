import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ActivityType,
  Difficulty,
  PrismaClient,
  RoleplayScenario,
  SkillCode,
  WritingType,
  // seed.ts runs standalone via `tsx`, never through the compiled dist/ app, so it
  // resolves the generated client's TS source directly rather than through the
  // '#prisma-client' subpath import (which points at the compiled dist output).
} from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

const SKILLS: { code: SkillCode; name: string; description: string }[] = [
  {
    code: 'GRAMMAR',
    name: 'Grammar',
    description: 'Correct and appropriate use of English grammar.',
  },
  {
    code: 'VOCABULARY',
    name: 'Vocabulary',
    description: 'Range and precision of word choice.',
  },
  {
    code: 'FLUENCY',
    name: 'Fluency',
    description: 'Smooth, natural flow of speech without excessive pausing.',
  },
  {
    code: 'PRONUNCIATION',
    name: 'Pronunciation',
    description: 'Clarity and accuracy of spoken sounds.',
  },
  {
    code: 'LISTENING',
    name: 'Listening',
    description: 'Comprehension of spoken English.',
  },
  {
    code: 'CLARITY',
    name: 'Clarity',
    description: 'How clearly ideas are structured and communicated.',
  },
  {
    code: 'CONFIDENCE',
    name: 'Confidence',
    description: 'Assuredness and composure while communicating.',
  },
  {
    code: 'PROFESSIONAL_TONE',
    name: 'Professional Tone',
    description: 'Appropriateness of tone for workplace contexts.',
  },
  {
    code: 'INTERVIEW',
    name: 'Interview Skills',
    description: 'Overall performance in interview settings.',
  },
  {
    code: 'CRITICAL_THINKING',
    name: 'Critical Thinking',
    description: 'Quality of reasoning and argumentation.',
  },
  {
    code: 'TECHNICAL_COMMUNICATION',
    name: 'Technical Communication',
    description: 'Ability to explain technical concepts clearly.',
  },
];

async function seedSkills() {
  const skills = new Map<SkillCode, string>();
  for (const skill of SKILLS) {
    const record = await prisma.skill.upsert({
      where: { code: skill.code },
      update: { name: skill.name, description: skill.description },
      create: skill,
    });
    skills.set(skill.code, record.id);
  }
  return skills;
}

async function seedActivities(skillIds: Map<SkillCode, string>) {
  const activities: {
    title: string;
    description: string;
    type: ActivityType;
    difficulty: Difficulty;
    skill: SkillCode;
    durationMinutes: number;
    instructions: string;
  }[] = [
    {
      title: '1-Minute Self Introduction',
      description:
        'Introduce yourself confidently in under a minute, as you would to an interviewer.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'CONFIDENCE',
      durationMinutes: 3,
      instructions:
        'Record a 60-second self introduction covering your background, skills, and goals.',
    },
    {
      title: 'Explain Your Final-Year Project',
      description:
        'Practice explaining your final-year project clearly to a non-technical interviewer.',
      type: 'SPEAKING',
      difficulty: 'INTERMEDIATE',
      skill: 'TECHNICAL_COMMUNICATION',
      durationMinutes: 5,
      instructions:
        'Describe the problem, your approach, the technologies used, and the outcome.',
    },
    {
      title: 'Tell Me About Yourself',
      description:
        'The classic opening interview question - practice a structured, confident answer.',
      type: 'INTERVIEW',
      difficulty: 'BEGINNER',
      skill: 'INTERVIEW',
      durationMinutes: 3,
      instructions:
        'Answer as you would in a real HR interview. Keep it under 90 seconds.',
    },
    {
      title: 'Team Conflict',
      description:
        'Practice navigating a disagreement with a teammate professionally.',
      type: 'ROLEPLAY',
      difficulty: 'INTERMEDIATE',
      skill: 'PROFESSIONAL_TONE',
      durationMinutes: 8,
      instructions:
        'Respond to a teammate who disagrees with your approach on a shared task.',
    },
    {
      title: 'Explain a Technical Concept',
      description:
        'Practice explaining a technical concept of your choice in simple terms.',
      type: 'SPEAKING',
      difficulty: 'INTERMEDIATE',
      skill: 'CLARITY',
      durationMinutes: 5,
      instructions:
        'Choose a concept (e.g. REST APIs, recursion) and explain it as if to a beginner.',
    },
    {
      title: 'Professional Email Writing',
      description:
        'Write a clear, professional email for a workplace scenario.',
      type: 'WRITING',
      difficulty: 'BEGINNER',
      skill: 'PROFESSIONAL_TONE',
      durationMinutes: 10,
      instructions:
        'Write a follow-up email after a job application, in a professional tone.',
    },
    {
      title: 'Elevator Pitch',
      description:
        'Craft and deliver a compelling 30-second professional introduction.',
      type: 'NETWORKING',
      difficulty: 'INTERMEDIATE',
      skill: 'CONFIDENCE',
      durationMinutes: 3,
      instructions:
        'Introduce yourself and your career goals as if meeting a recruiter at a career fair.',
    },
    {
      title: 'AI in Software Development Debate',
      description:
        'Argue a position on the impact of AI tools on software development careers.',
      type: 'DEBATE',
      difficulty: 'ADVANCED',
      skill: 'CRITICAL_THINKING',
      durationMinutes: 10,
      instructions:
        'Take a position (for or against) and defend it with structured arguments.',
    },
    {
      title: 'Everyday Vocabulary Builder',
      description:
        'Practice using a set of professional vocabulary words in original sentences.',
      type: 'VOCABULARY',
      difficulty: 'BEGINNER',
      skill: 'VOCABULARY',
      durationMinutes: 5,
      instructions:
        'Use each given word correctly in a full, professional sentence.',
    },
    {
      title: 'Grammar Check: Common Mistakes',
      description:
        'Identify and correct common grammar mistakes in professional writing.',
      type: 'GRAMMAR',
      difficulty: 'BEGINNER',
      skill: 'GRAMMAR',
      durationMinutes: 5,
      instructions:
        'Write a short paragraph about your weekend, focusing on correct tense usage.',
    },

    // --- General conversation topics (free-form speaking practice via the AI conversation coach) ---
    {
      title: 'Talk About Anything',
      description: 'Have a free, open conversation about any topic you like.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'FLUENCY',
      durationMinutes: 5,
      instructions:
        'Start talking about anything on your mind and keep the conversation going naturally.',
    },
    {
      title: 'Daily Routine',
      description: 'Describe what a typical day looks like for you.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'FLUENCY',
      durationMinutes: 5,
      instructions:
        'Describe your day from when you wake up to when you go to sleep.',
    },
    {
      title: "Let's Improve Vocabulary",
      description:
        'Practice using new everyday words correctly in conversation.',
      type: 'VOCABULARY',
      difficulty: 'BEGINNER',
      skill: 'VOCABULARY',
      durationMinutes: 5,
      instructions:
        'Use each new word you learn in a full, natural sentence about your own life.',
    },
    {
      title: 'Talk About Your Childhood Memory',
      description: 'Share a memorable story from when you were younger.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'FLUENCY',
      durationMinutes: 5,
      instructions:
        'Share a childhood memory - where it happened, who was there, and why you remember it.',
    },
    {
      title: 'Seasons and Weather',
      description: 'Talk about the weather and seasons where you live.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'VOCABULARY',
      durationMinutes: 5,
      instructions:
        'Describe the weather in each season where you live, and say which one you like best and why.',
    },
    {
      title: 'Family and Relationships',
      description: 'Talk about your family and the people close to you.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'FLUENCY',
      durationMinutes: 5,
      instructions:
        'Talk about your family members and the relationships you share with them.',
    },
    {
      title: 'Hobbies and Interests',
      description: 'Talk about what you enjoy doing in your free time.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'FLUENCY',
      durationMinutes: 5,
      instructions:
        'Describe your hobbies and interests, and how you got into them.',
    },
    {
      title: 'Talk About Your Workplace',
      description: 'Describe your workplace or college and the people there.',
      type: 'SPEAKING',
      difficulty: 'INTERMEDIATE',
      skill: 'PROFESSIONAL_TONE',
      durationMinutes: 5,
      instructions:
        'Describe your workplace or college, your daily tasks, and the people you interact with.',
    },
    {
      title: 'I Need Your Opinion',
      description: 'Share your opinion on a topic and explain your reasoning.',
      type: 'DEBATE',
      difficulty: 'INTERMEDIATE',
      skill: 'CRITICAL_THINKING',
      durationMinutes: 5,
      instructions:
        'Pick a topic you have an opinion about and explain your view with reasons.',
    },
    {
      title: 'Practice to Argue',
      description:
        'Pick a position on a topic and defend it with strong arguments.',
      type: 'DEBATE',
      difficulty: 'INTERMEDIATE',
      skill: 'CRITICAL_THINKING',
      durationMinutes: 7,
      instructions:
        'Take a clear position on a topic of your choice and defend it with structured arguments.',
    },
    {
      title: "Let's Plan a Trip",
      description: 'Plan an imaginary trip and describe the details.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'FLUENCY',
      durationMinutes: 5,
      instructions:
        'Plan an imaginary trip - where you would go, what you would do, and who you would take.',
    },
    {
      title: 'Food and Cooking',
      description: 'Talk about your favorite foods and cooking.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'VOCABULARY',
      durationMinutes: 5,
      instructions:
        'Talk about your favorite foods and any cooking you enjoy doing.',
    },
    {
      title: 'Order Food at a Restaurant',
      description: 'Practice ordering a meal at a restaurant.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'CONFIDENCE',
      durationMinutes: 5,
      instructions:
        'Practice ordering a meal, asking about the menu, and making requests politely.',
    },
    {
      title: 'Customer Service Conversation',
      description: 'Practice a customer service conversation from either side.',
      type: 'SPEAKING',
      difficulty: 'INTERMEDIATE',
      skill: 'PROFESSIONAL_TONE',
      durationMinutes: 5,
      instructions:
        'Practice handling a customer service conversation, either as the customer or the representative.',
    },
    {
      title: 'Asking for a Menu Recommendation',
      description: 'Practice asking for food recommendations.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'CLARITY',
      durationMinutes: 5,
      instructions:
        'Practice asking a waiter for recommendations and describing what kind of food you like.',
    },
    {
      title: 'Order Tea or Coffee at a Cafe',
      description: 'Practice ordering a drink at a cafe.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'CONFIDENCE',
      durationMinutes: 3,
      instructions:
        'Practice ordering a drink at a cafe, including size, customizations, and payment.',
    },
    {
      title: 'Introducing Yourself',
      description: 'Practice introducing yourself to someone new.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'CONFIDENCE',
      durationMinutes: 3,
      instructions:
        'Practice introducing yourself to someone new - your name, background, and interests.',
    },
    {
      title: 'Talking About Movies',
      description: 'Talk about your favorite movies and genres.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'VOCABULARY',
      durationMinutes: 5,
      instructions:
        'Talk about your favorite movies, genres, and actors, and why you like them.',
    },
    {
      title: 'Talking About Music',
      description: 'Talk about the kind of music you enjoy.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'VOCABULARY',
      durationMinutes: 5,
      instructions:
        'Talk about the kind of music you enjoy and why, and any artists you like.',
    },
    {
      title: 'Health and Fitness',
      description: 'Talk about how you stay healthy.',
      type: 'SPEAKING',
      difficulty: 'INTERMEDIATE',
      skill: 'FLUENCY',
      durationMinutes: 5,
      instructions:
        'Talk about how you stay healthy, your fitness routine, and your diet.',
    },
    {
      title: 'Technology in Daily Life',
      description: 'Talk about the technology you use every day.',
      type: 'SPEAKING',
      difficulty: 'INTERMEDIATE',
      skill: 'TECHNICAL_COMMUNICATION',
      durationMinutes: 5,
      instructions:
        'Talk about the technology you use every day and how it helps you.',
    },
    {
      title: 'Environment and Nature',
      description: 'Share your thoughts on protecting the environment.',
      type: 'SPEAKING',
      difficulty: 'INTERMEDIATE',
      skill: 'CRITICAL_THINKING',
      durationMinutes: 5,
      instructions:
        'Share your thoughts on protecting the environment and living sustainably.',
    },
    {
      title: 'Shopping Experience',
      description: 'Talk about your last shopping trip.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'CONFIDENCE',
      durationMinutes: 5,
      instructions:
        'Talk about your last shopping trip - what you bought and how the experience was.',
    },
    {
      title: 'Asking for Directions',
      description: 'Practice asking for and giving directions.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'CLARITY',
      durationMinutes: 3,
      instructions:
        'Practice asking for and giving directions to a place in your city.',
    },
    {
      title: 'Making a Complaint',
      description: 'Practice politely making a complaint.',
      type: 'SPEAKING',
      difficulty: 'INTERMEDIATE',
      skill: 'PROFESSIONAL_TONE',
      durationMinutes: 5,
      instructions:
        'Practice politely making a complaint about a product or service.',
    },
    {
      title: 'Booking a Hotel Room',
      description: 'Practice a conversation to book a hotel room.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'CLARITY',
      durationMinutes: 5,
      instructions:
        'Practice a conversation to book a hotel room, asking about availability and price.',
    },
    {
      title: 'At the Airport',
      description: 'Practice conversations you might have at the airport.',
      type: 'SPEAKING',
      difficulty: 'INTERMEDIATE',
      skill: 'CLARITY',
      durationMinutes: 5,
      instructions:
        'Practice a conversation you might have at the airport, from check-in to boarding.',
    },
    {
      title: 'Discussing Current News',
      description: 'Share your thoughts on a recent news story.',
      type: 'SPEAKING',
      difficulty: 'ADVANCED',
      skill: 'CRITICAL_THINKING',
      durationMinutes: 7,
      instructions:
        'Share your thoughts on a recent news story and its impact.',
    },
    {
      title: 'Talking About Books',
      description: "Talk about a book you've read recently.",
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'VOCABULARY',
      durationMinutes: 5,
      instructions:
        "Talk about a book you've read recently and what you liked about it.",
    },
    {
      title: 'Social Media Habits',
      description: 'Talk about how you use social media.',
      type: 'SPEAKING',
      difficulty: 'INTERMEDIATE',
      skill: 'CRITICAL_THINKING',
      durationMinutes: 5,
      instructions:
        'Talk about how you use social media and share its pros and cons.',
    },
    {
      title: 'Time Management',
      description: 'Talk about how you manage your time.',
      type: 'SPEAKING',
      difficulty: 'INTERMEDIATE',
      skill: 'CLARITY',
      durationMinutes: 5,
      instructions: 'Talk about how you manage your time and stay productive.',
    },
    {
      title: 'Study Habits',
      description: 'Talk about how you study and prepare for exams.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'FLUENCY',
      durationMinutes: 5,
      instructions: 'Talk about how you study and prepare for exams.',
    },
    {
      title: 'Future Goals',
      description: 'Talk about your career and personal goals.',
      type: 'SPEAKING',
      difficulty: 'INTERMEDIATE',
      skill: 'CONFIDENCE',
      durationMinutes: 5,
      instructions:
        'Talk about your career and personal goals for the next five years.',
    },
    {
      title: 'Describing a Festival',
      description: 'Describe a festival or celebration you enjoy.',
      type: 'SPEAKING',
      difficulty: 'BEGINNER',
      skill: 'VOCABULARY',
      durationMinutes: 5,
      instructions:
        "Describe a festival or celebration you enjoy and how it's celebrated.",
    },

    // --- Interview-tab topic cards (quick single-topic practice, separate from the full mock interview flow) ---
    {
      title: 'Tell Me About Your Strengths',
      description: 'Practice describing your key strengths with examples.',
      type: 'INTERVIEW',
      difficulty: 'BEGINNER',
      skill: 'INTERVIEW',
      durationMinutes: 3,
      instructions:
        'Describe two or three of your key strengths, each with a short real example.',
    },
    {
      title: 'Tell Me About Your Weaknesses',
      description:
        'Practice describing a real weakness and how you are improving it.',
      type: 'INTERVIEW',
      difficulty: 'BEGINNER',
      skill: 'INTERVIEW',
      durationMinutes: 3,
      instructions:
        'Describe a genuine weakness and what you are doing to improve it.',
    },
    {
      title: 'Why Do You Want This Job',
      description: 'Practice explaining why you want a specific job or role.',
      type: 'INTERVIEW',
      difficulty: 'INTERMEDIATE',
      skill: 'INTERVIEW',
      durationMinutes: 3,
      instructions:
        'Practice explaining why you want a specific job or role, and what draws you to it.',
    },
    {
      title: 'Describe a Challenge You Overcame',
      description:
        'Practice describing a challenge you faced and how you solved it.',
      type: 'INTERVIEW',
      difficulty: 'INTERMEDIATE',
      skill: 'INTERVIEW',
      durationMinutes: 5,
      instructions:
        'Describe a real challenge you faced, what you did about it, and what you learned.',
    },
    {
      title: 'Where Do You See Yourself in 5 Years',
      description: 'Practice answering this common interview question clearly.',
      type: 'INTERVIEW',
      difficulty: 'BEGINNER',
      skill: 'INTERVIEW',
      durationMinutes: 3,
      instructions:
        'Answer where you see yourself in five years, clearly and confidently.',
    },
    {
      title: 'Salary Expectation Conversation',
      description: 'Practice discussing salary expectations professionally.',
      type: 'INTERVIEW',
      difficulty: 'ADVANCED',
      skill: 'PROFESSIONAL_TONE',
      durationMinutes: 3,
      instructions:
        'Practice discussing your salary expectations professionally and confidently.',
    },
  ];

  for (const activity of activities) {
    const skillId = skillIds.get(activity.skill);
    if (!skillId) continue;
    await prisma.activity.upsert({
      where: { title: activity.title },
      update: {
        description: activity.description,
        type: activity.type,
        difficulty: activity.difficulty,
        skillId,
        durationMinutes: activity.durationMinutes,
        instructions: activity.instructions,
      },
      create: {
        title: activity.title,
        description: activity.description,
        type: activity.type,
        difficulty: activity.difficulty,
        skillId,
        durationMinutes: activity.durationMinutes,
        instructions: activity.instructions,
      },
    });
  }
}

async function seedInterviews() {
  const interviews: {
    title: string;
    type: 'HR' | 'TECHNICAL' | 'PROJECT';
    description: string;
    difficulty: Difficulty;
    durationMinutes: number;
    questions: string[];
  }[] = [
    {
      title: 'HR Interview: Fresher Round',
      type: 'HR',
      description: 'A standard HR round for freshman/entry-level placements.',
      difficulty: 'BEGINNER',
      durationMinutes: 15,
      questions: [
        'Tell me about yourself.',
        'What are your strengths and weaknesses?',
        'Why should we hire you?',
        'Where do you see yourself in five years?',
        'Do you have any questions for us?',
      ],
    },
    {
      title: 'Technical Interview: Core CS Fundamentals',
      type: 'TECHNICAL',
      description: 'Covers data structures, algorithms, and core CS concepts.',
      difficulty: 'INTERMEDIATE',
      durationMinutes: 20,
      questions: [
        'Explain the difference between an array and a linked list.',
        'What is time complexity, and why does it matter?',
        'Explain how a hash map works.',
        'What is the difference between SQL and NoSQL databases?',
        'Describe a project where you solved a challenging technical problem.',
      ],
    },
    {
      title: 'Project Interview: Explain Your Work',
      type: 'PROJECT',
      description:
        'Focused on explaining your academic or personal projects clearly.',
      difficulty: 'INTERMEDIATE',
      durationMinutes: 15,
      questions: [
        'Walk me through your most significant project.',
        'What was the biggest challenge you faced, and how did you solve it?',
        'What would you do differently if you started this project again?',
        'What technologies did you use, and why?',
      ],
    },
  ];

  for (const interview of interviews) {
    const record = await prisma.interview.upsert({
      where: { title: interview.title },
      update: {
        type: interview.type,
        description: interview.description,
        difficulty: interview.difficulty,
        durationMinutes: interview.durationMinutes,
      },
      create: {
        title: interview.title,
        type: interview.type,
        description: interview.description,
        difficulty: interview.difficulty,
        durationMinutes: interview.durationMinutes,
      },
    });

    for (const [index, questionText] of interview.questions.entries()) {
      await prisma.interviewQuestion.upsert({
        where: {
          interviewId_order: { interviewId: record.id, order: index + 1 },
        },
        update: { questionText },
        create: { interviewId: record.id, order: index + 1, questionText },
      });
    }
  }
}

async function seedRoleplays() {
  const roleplays: {
    title: string;
    scenario: RoleplayScenario;
    description: string;
    difficulty: Difficulty;
  }[] = [
    {
      title: 'Disagreeing With a Teammate',
      scenario: 'TEAM_CONFLICT',
      description:
        'A teammate disagrees with your proposed approach to a shared task.',
      difficulty: 'INTERMEDIATE',
    },
    {
      title: 'Status Update to Your Manager',
      scenario: 'TALKING_TO_MANAGER',
      description:
        'Your manager is concerned about a delayed project milestone.',
      difficulty: 'INTERMEDIATE',
    },
    {
      title: 'Handling a Customer Complaint',
      scenario: 'CUSTOMER_CONVERSATION',
      description:
        'A customer is unhappy about a bug in the product they are using.',
      difficulty: 'ADVANCED',
    },
    {
      title: 'Asking a Senior for Help',
      scenario: 'ASKING_FOR_HELP',
      description:
        'You are stuck on a task and need to ask a senior colleague for guidance.',
      difficulty: 'BEGINNER',
    },
    {
      title: 'Giving Constructive Feedback',
      scenario: 'GIVING_FEEDBACK',
      description:
        'You need to give a teammate feedback on their code quality.',
      difficulty: 'INTERMEDIATE',
    },
    {
      title: 'Handling a Disagreement on Design',
      scenario: 'HANDLING_DISAGREEMENT',
      description: 'A colleague disagrees with a technical decision you made.',
      difficulty: 'ADVANCED',
    },
    {
      title: 'Solving a Workplace Problem Together',
      scenario: 'WORKPLACE_PROBLEM_SOLVING',
      description:
        'You and a teammate need to jointly resolve a process issue.',
      difficulty: 'INTERMEDIATE',
    },
  ];

  for (const roleplay of roleplays) {
    await prisma.roleplay.upsert({
      where: { title: roleplay.title },
      update: {
        scenario: roleplay.scenario,
        description: roleplay.description,
        difficulty: roleplay.difficulty,
      },
      create: roleplay,
    });
  }
}

async function seedDebates() {
  const debates: {
    topic: string;
    description: string;
    difficulty: Difficulty;
  }[] = [
    {
      topic: 'AI in Software Development Debate',
      description: 'Will AI coding tools replace software developers?',
      difficulty: 'ADVANCED',
    },
    {
      topic: 'Remote Work vs Office Work',
      description:
        'Is remote work more productive than working from an office?',
      difficulty: 'INTERMEDIATE',
    },
    {
      topic: 'Social Media: Boon or Bane',
      description:
        'Does social media do more good than harm for young professionals?',
      difficulty: 'BEGINNER',
    },
  ];

  for (const debate of debates) {
    await prisma.debate.upsert({
      where: { topic: debate.topic },
      update: {
        description: debate.description,
        difficulty: debate.difficulty,
      },
      create: debate,
    });
  }
}

async function seedWritingActivities() {
  const activities: {
    title: string;
    description: string;
    type: WritingType;
    prompt: string;
    difficulty: Difficulty;
  }[] = [
    {
      title: 'Internship Application Follow-up',
      description:
        'Write a polite follow-up email after applying for an internship.',
      type: 'FOLLOW_UP_EMAIL',
      prompt:
        'Write a follow-up email to a recruiter one week after submitting your application.',
      difficulty: 'BEGINNER',
    },
    {
      title: 'Requesting an Internship',
      description: 'Write an email requesting an internship opportunity.',
      type: 'INTERNSHIP_REQUEST',
      prompt:
        'Write an email to a company requesting a summer internship, highlighting your relevant skills.',
      difficulty: 'BEGINNER',
    },
    {
      title: 'Scheduling a Meeting',
      description:
        'Write an email requesting a meeting with your project mentor.',
      type: 'MEETING_REQUEST',
      prompt:
        'Write an email requesting a 30-minute meeting to discuss your project progress.',
      difficulty: 'BEGINNER',
    },
    {
      title: 'Weekly Project Status Update',
      description: 'Write a concise status update email to your team lead.',
      type: 'PROJECT_UPDATE',
      prompt:
        'Write a status update email summarizing what you completed this week and any blockers.',
      difficulty: 'INTERMEDIATE',
    },
    {
      title: 'Professional Chat Message',
      description:
        'Respond professionally to a colleague on a workplace chat tool.',
      type: 'PROFESSIONAL_CHAT',
      prompt:
        'A colleague messages you asking for an update on a shared task - reply professionally.',
      difficulty: 'BEGINNER',
    },
  ];

  for (const activity of activities) {
    await prisma.writingActivity.upsert({
      where: { title: activity.title },
      update: {
        description: activity.description,
        type: activity.type,
        prompt: activity.prompt,
        difficulty: activity.difficulty,
      },
      create: activity,
    });
  }
}

async function main() {
  const skillIds = await seedSkills();
  await seedActivities(skillIds);
  await seedInterviews();
  await seedRoleplays();
  await seedDebates();
  await seedWritingActivities();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
