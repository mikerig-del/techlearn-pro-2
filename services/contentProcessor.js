const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
const db = require('../utils/database');
const { v4: uuidv4 } = require('uuid');

// Initialize OpenAI (will check for API key at runtime)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

/**
 * Process uploaded content and extract information
 */
async function processContent(contentId, filePath, mimeType) {
  try {
    console.log(`Processing content ${contentId}...`);

    let extractedData = {};
    
    if (mimeType === 'application/pdf') {
      extractedData = await processPDF(filePath);
    } else if (mimeType.startsWith('video/')) {
      extractedData = await processVideo(filePath);
    } else {
      extractedData = { text: 'File type not yet processed', sections: [] };
    }

    // Use AI to generate learning content if OpenAI is configured
    if (openai && extractedData.text) {
      const aiEnhanced = await enhanceWithAI(extractedData.text);
      extractedData = { ...extractedData, ...aiEnhanced };
    }

    // Update content item with extracted data
    await db.run(
      `UPDATE content_items 
       SET extracted_data = ?, status = 'ready', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(extractedData), contentId]
    );

    // Auto-create learning module
    await createLearningModule(contentId, extractedData);

    console.log(`Content ${contentId} processed successfully`);
  } catch (error) {
    console.error(`Error processing content ${contentId}:`, error);
    
    // Update status to error
    await db.run(
      `UPDATE content_items 
       SET status = 'error', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [contentId]
    );
  }
}

/**
 * Process PDF file
 */
async function processPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    // Extract text and basic structure
    const text = data.text;
    const sections = extractSections(text);

    return {
      text,
      sections,
      numPages: data.numpages,
      info: data.info
    };
  } catch (error) {
    console.error('PDF processing error:', error);
    return { text: '', sections: [], error: error.message };
  }
}

/**
 * Process video file (placeholder for future implementation)
 */
async function processVideo(filePath) {
  // Future: Integrate with Whisper API for transcription
  const stats = fs.statSync(filePath);
  
  return {
    fileSize: stats.size,
    duration: null, // Would need video metadata extraction
    transcript: null,
    note: 'Video transcription requires OpenAI Whisper API integration'
  };
}

/**
 * Extract sections from text
 */
function extractSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let currentSection = null;

  lines.forEach(line => {
    line = line.trim();
    if (!line) return;

    // Detect headings (simple heuristic: short lines, uppercase, or numbered)
    if (
      line.length < 100 && 
      (line.toUpperCase() === line || /^\d+\./.test(line) || /^Chapter|^Section|^Module/i.test(line))
    ) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        title: line,
        content: []
      };
    } else if (currentSection) {
      currentSection.content.push(line);
    }
  });

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Enhance content with AI
 */
async function enhanceWithAI(text) {
  if (!openai) {
    console.log('OpenAI not configured, skipping AI enhancement');
    return {};
  }

  try {
    // Limit text length for API
    const textSample = text.substring(0, 10000);

    // Generate learning objectives
    const objectivesPrompt = `Based on this technical training content, generate 3-5 clear learning objectives. Format as a JSON array of strings.

Content:
${textSample}

Respond with ONLY a JSON array, no other text.`;

    const objectivesResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: objectivesPrompt }],
      temperature: 0.7,
      max_tokens: 300
    });

    let learningObjectives = [];
    try {
      learningObjectives = JSON.parse(objectivesResponse.choices[0].message.content);
    } catch (e) {
      learningObjectives = ['Understand key concepts', 'Apply learned techniques', 'Demonstrate proficiency'];
    }

    // Generate quiz questions
    const questionsPrompt = `Based on this technical training content, generate 5 multiple-choice quiz questions. Each question should have 4 options (A, B, C, D) with one correct answer.

Format as JSON array:
[
  {
    "question": "Question text?",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
    "correct": "A",
    "explanation": "Why this is correct"
  }
]

Content:
${textSample}

Respond with ONLY a JSON array, no other text.`;

    const questionsResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: questionsPrompt }],
      temperature: 0.8,
      max_tokens: 1500
    });

    let questions = [];
    try {
      questions = JSON.parse(questionsResponse.choices[0].message.content);
    } catch (e) {
      console.error('Failed to parse AI questions:', e);
      questions = [];
    }

    return {
      learningObjectives,
      generatedQuestions: questions,
      aiProcessed: true
    };
  } catch (error) {
    console.error('AI enhancement error:', error);
    return { aiProcessed: false, error: error.message };
  }
}

/**
 * Create learning module from processed content
 */
async function createLearningModule(contentId, extractedData) {
  try {
    // Get content item details
    const content = await db.get('SELECT * FROM content_items WHERE id = ?', [contentId]);
    if (!content) return;

    const moduleId = 'module-' + uuidv4();
    
    // Calculate estimated duration (rough estimate: 200 words per minute)
    const wordCount = extractedData.text ? extractedData.text.split(/\s+/).length : 0;
    const estimatedDuration = Math.max(5, Math.ceil(wordCount / 200));

    // Create module
    await db.run(
      `INSERT INTO learning_modules 
       (id, title, description, content_item_id, learning_objectives, 
        estimated_duration_minutes, difficulty_level, organization_id, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        moduleId,
        content.title,
        content.description || `Learning module for ${content.title}`,
        contentId,
        JSON.stringify(extractedData.learningObjectives || []),
        estimatedDuration,
        'beginner',
        content.organization_id,
        1 // Auto-publish
      ]
    );

    // Create questions if generated by AI
    if (extractedData.generatedQuestions && extractedData.generatedQuestions.length > 0) {
      for (const q of extractedData.generatedQuestions) {
        const questionId = 'question-' + uuidv4();
        await db.run(
          `INSERT INTO questions 
           (id, module_id, question_text, question_type, options, correct_answer, explanation, difficulty_level, points)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            questionId,
            moduleId,
            q.question,
            'multiple_choice',
            JSON.stringify(q.options || []),
            q.correct,
            q.explanation || '',
            'medium',
            1
          ]
        );
      }
    }

    console.log(`Created learning module ${moduleId} for content ${contentId}`);
  } catch (error) {
    console.error('Error creating learning module:', error);
  }
}

module.exports = {
  processContent
};
