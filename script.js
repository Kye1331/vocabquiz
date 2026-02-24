// Global State
let vocabulary = [];
let currentMode = null;
let currentUnit = null;
let currentSubset = null;
let currentCardIndex = 0;
let currentTestIndex = 0;
let testAnswers = [];
let testStartTime = null;
let currentWords = [];
let currentQuestionType = null;

// Storage Keys
const STATS_KEY = 'japaneseVocabStats';
const UNFAMILIAR_KEY = 'japaneseVocabUnfamiliar';

// Question Types
const QUESTION_TYPES = ['multiple-choice', 'short-answer-to-english'];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadVocabularyFile();
});

// Load vocabulary.txt automatically
async function loadVocabularyFile() {
    try {
        const response = await fetch('vocabulary.txt');
        const content = await response.text();
        parseVocabulary(content);
        showModeSelection();
    } catch (error) {
        console.error('Error loading vocabulary file:', error);
        alert('Error loading vocabulary.txt. Please make sure the file exists in the same directory.');
    }
}

// Event Listeners
function initializeEventListeners() {
    // Mode selection
    document.getElementById('flashcard-btn').addEventListener('click', () => selectMode('flashcard'));
    document.getElementById('unit-test-btn').addEventListener('click', () => selectMode('unit-test'));
    document.getElementById('subset-test-btn').addEventListener('click', () => selectMode('subset-test'));
    document.getElementById('stats-btn').addEventListener('click', showStatistics);
    document.getElementById('unfamiliar-btn').addEventListener('click', showUnfamiliarWords);
    
    // Flashcard controls
    document.getElementById('prev-card').addEventListener('click', () => navigateCard(-1));
    document.getElementById('next-card').addEventListener('click', () => navigateCard(1));
    document.getElementById('flip-card').addEventListener('click', flipCard);
    document.getElementById('flashcard').addEventListener('click', flipCard);
    
    // Difficulty buttons
    document.getElementById('easy-btn').addEventListener('click', () => recordDifficulty('easy'));
    document.getElementById('medium-btn').addEventListener('click', () => recordDifficulty('medium'));
    document.getElementById('hard-btn').addEventListener('click', () => recordDifficulty('hard'));
    document.getElementById('uncertain-btn').addEventListener('click', () => markAsUncertain());
    
    // Test controls
    document.getElementById('submit-answer').addEventListener('click', submitAnswer);
    document.getElementById('next-question').addEventListener('click', nextQuestion);
    document.getElementById('mark-uncertain-test').addEventListener('click', () => markAsUncertainTest());
    document.getElementById('test-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !document.getElementById('submit-answer').classList.contains('hidden')) {
            submitAnswer();
        }
    });
    
    // Navigation
    document.getElementById('back-to-mode').addEventListener('click', showModeSelection);
    document.getElementById('exit-flashcard').addEventListener('click', backToSelection);
    document.getElementById('exit-test').addEventListener('click', backToSelection);
    document.getElementById('back-to-selection').addEventListener('click', backToSelection);
    document.getElementById('exit-stats').addEventListener('click', showModeSelection);
    document.getElementById('exit-unfamiliar').addEventListener('click', showModeSelection);
    
    // Stats filters
    document.getElementById('filter-all').addEventListener('click', () => filterStats('all'));
    document.getElementById('filter-mastered').addEventListener('click', () => filterStats('mastered'));
    document.getElementById('filter-learning').addEventListener('click', () => filterStats('learning'));
    document.getElementById('filter-difficult').addEventListener('click', () => filterStats('difficult'));
    
    // Reset and clear buttons
    document.getElementById('reset-stats-btn').addEventListener('click', resetStatistics);
    document.getElementById('clear-unfamiliar-btn').addEventListener('click', clearUnfamiliarWords);
}

// Parse Vocabulary File
function parseVocabulary(content) {
    const lines = content.split('\n').filter(line => line.trim());
    vocabulary = [];
    
    lines.forEach(line => {
        const parts = line.split('\t');
        if (parts.length >= 3) {
            vocabulary.push({
                kanji: parts[0].trim(),
                romaji: parts[1].trim(),
                english: parts[2].trim()
            });
        }
    });
    
    console.log(`Loaded ${vocabulary.length} words`);
    updateStatsSummary();
}

// Unfamiliar Words Functions
function getUnfamiliarWords() {
    return JSON.parse(localStorage.getItem(UNFAMILIAR_KEY) || '[]');
}

function addUnfamiliarWord(kanji) {
    const unfamiliar = getUnfamiliarWords();
    if (!unfamiliar.includes(kanji)) {
        unfamiliar.push(kanji);
        localStorage.setItem(UNFAMILIAR_KEY, JSON.stringify(unfamiliar));
    }
}

function removeUnfamiliarWord(kanji) {
    const unfamiliar = getUnfamiliarWords();
    const filtered = unfamiliar.filter(k => k !== kanji);
    localStorage.setItem(UNFAMILIAR_KEY, JSON.stringify(filtered));
}

function clearUnfamiliarWords() {
    if (confirm('Are you sure you want to clear all unfamiliar words?')) {
        localStorage.removeItem(UNFAMILIAR_KEY);
        showUnfamiliarWords();
    }
}

function markAsUncertain() {
    const card = currentWords[currentCardIndex];
    addUnfamiliarWord(card.kanji);
    alert(`"${card.kanji}" marked as uncertain!`);
}

function markAsUncertainTest() {
    const word = currentWords[currentTestIndex];
    addUnfamiliarWord(word.kanji);
    alert(`"${word.kanji}" marked as uncertain!`);
}

function showUnfamiliarWords() {
    hideAllSections();
    const unfamiliar = getUnfamiliarWords();
    const content = document.getElementById('unfamiliar-content');
    
    if (unfamiliar.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: #666;">No unfamiliar words yet. Mark words as uncertain during study!</p>';
    } else {
        let html = '<div class="unfamiliar-list">';
        unfamiliar.forEach(kanji => {
            const word = vocabulary.find(w => w.kanji === kanji);
            if (word) {
                html += `
                    <div class="unfamiliar-item">
                        <div>
                            <strong>${word.kanji}</strong> (${word.romaji}) - ${word.english}
                        </div>
                        <button onclick="removeUnfamiliarWord('${kanji}'); showUnfamiliarWords();" class="remove-btn">Remove</button>
                    </div>
                `;
            }
        });
        html += '</div>';
        content.innerHTML = html;
    }
    
    document.getElementById('unfamiliar-section').classList.remove('hidden');
}

// Show Mode Selection
function showModeSelection() {
    hideAllSections();
    document.getElementById('mode-selection').classList.remove('hidden');
}

// Select Mode
function selectMode(mode) {
    currentMode = mode;
    
    if (mode === 'flashcard' || mode === 'unit-test') {
        showUnitSelection();
    } else if (mode === 'subset-test') {
        showSubsetSelection();
    }
}

// Show Unit Selection
function showUnitSelection() {
    hideAllSections();
    const section = document.getElementById('selection-section');
    const title = document.getElementById('selection-title');
    const buttons = document.getElementById('selection-buttons');
    
    title.textContent = 'Select Unit (50 words each)';
    buttons.innerHTML = '';
    
    const numUnits = Math.ceil(vocabulary.length / 50);
    for (let i = 0; i < numUnits; i++) {
        const btn = document.createElement('button');
        const start = i * 50;
        const end = Math.min((i + 1) * 50, vocabulary.length);
        btn.textContent = `Unit ${i + 1} (${start + 1}-${end})`;
        btn.addEventListener('click', () => selectUnit(i));
        buttons.appendChild(btn);
    }
    
    section.classList.remove('hidden');
}

// Show Subset Selection
function showSubsetSelection() {
    hideAllSections();
    const section = document.getElementById('selection-section');
    const title = document.getElementById('selection-title');
    const buttons = document.getElementById('selection-buttons');
    
    title.textContent = 'Select Subset (10 words each)';
    buttons.innerHTML = '';
    
    const numSubsets = Math.ceil(vocabulary.length / 10);
    for (let i = 0; i < numSubsets; i++) {
        const btn = document.createElement('button');
        const start = i * 10;
        const end = Math.min((i + 1) * 10, vocabulary.length);
        btn.textContent = `Subset ${i + 1} (${start + 1}-${end})`;
        btn.addEventListener('click', () => selectSubset(i));
        buttons.appendChild(btn);
    }
    
    section.classList.remove('hidden');
}

// Select Unit
function selectUnit(unitIndex) {
    currentUnit = unitIndex;
    const start = unitIndex * 50;
    const end = Math.min((unitIndex + 1) * 50, vocabulary.length);
    const words = vocabulary.slice(start, end);
    
    if (currentMode === 'flashcard') {
        startFlashcards(words);
    } else if (currentMode === 'unit-test') {
        startTest(words);
    }
}

// Select Subset
function selectSubset(subsetIndex) {
    currentSubset = subsetIndex;
    const start = subsetIndex * 10;
    const end = Math.min((subsetIndex + 1) * 10, vocabulary.length);
    const words = vocabulary.slice(start, end);
    
    startTest(words);
}

// Randomize array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Start Flashcards
function startFlashcards(words) {
    hideAllSections();
    currentCardIndex = 0;
    currentWords = shuffleArray(words);
    
    document.getElementById('flashcard-section').classList.remove('hidden');
    displayCard();
}

// Display Card
function displayCard() {
    const card = currentWords[currentCardIndex];
    document.getElementById('flashcard-question').textContent = card.kanji;
    document.getElementById('flashcard-answer').innerHTML = `
        <div><strong>${card.romaji}</strong></div>
        <div style="margin-top: 10px;">${card.english}</div>
    `;
    
    document.getElementById('flashcard').classList.remove('flipped');
    updateCardCounter();
    updateFlashcardProgress();
    
    document.getElementById('prev-card').disabled = currentCardIndex === 0;
    document.getElementById('next-card').disabled = currentCardIndex === currentWords.length - 1;
}

// Flip Card
function flipCard() {
    document.getElementById('flashcard').classList.toggle('flipped');
}

// Navigate Card
function navigateCard(direction) {
    currentCardIndex += direction;
    currentCardIndex = Math.max(0, Math.min(currentCardIndex, currentWords.length - 1));
    displayCard();
}

// Record Difficulty
function recordDifficulty(difficulty) {
    const card = currentWords[currentCardIndex];
    const stats = getWordStats(card.kanji);
    
    stats.lastReviewed = Date.now();
    stats.reviewCount++;
    
    if (difficulty === 'easy') {
        stats.correctCount++;
        stats.consecutiveCorrect++;
    } else if (difficulty === 'hard') {
        stats.consecutiveCorrect = 0;
    } else {
        stats.consecutiveCorrect = Math.max(0, stats.consecutiveCorrect - 1);
    }
    
    saveWordStats(card.kanji, stats);
    
    if (currentCardIndex < currentWords.length - 1) {
        navigateCard(1);
    }
}

// Update Card Counter
function updateCardCounter() {
    document.getElementById('card-counter').textContent = 
        `Card ${currentCardIndex + 1} of ${currentWords.length}`;
}

// Update Flashcard Progress
function updateFlashcardProgress() {
    const progress = ((currentCardIndex + 1) / currentWords.length) * 100;
    document.getElementById('flashcard-progress').style.width = progress + '%';
}

// Start Test
function startTest(words) {
    hideAllSections();
    currentTestIndex = 0;
    currentWords = shuffleArray(words);
    testAnswers = [];
    testStartTime = Date.now();
    
    document.getElementById('test-section').classList.remove('hidden');
    displayQuestion();
}

// Get random question type
function getRandomQuestionType() {
    return QUESTION_TYPES[Math.floor(Math.random() * QUESTION_TYPES.length)];
}

// Display Question
function displayQuestion() {
    const word = currentWords[currentTestIndex];
    currentQuestionType = getRandomQuestionType();
    
    // Randomly decide whether to show kanji or romaji
    const showKanji = Math.random() < 0.5;
    
    const badge = document.getElementById('question-type-badge');
    const questionEl = document.getElementById('test-question');
    const inputContainer = document.getElementById('test-input-container');
    const mcContainer = document.getElementById('multiple-choice-container');
    const input = document.getElementById('test-input');
    
    // Reset UI
    inputContainer.classList.add('hidden');
    mcContainer.classList.add('hidden');
    document.getElementById('test-feedback').classList.add('hidden');
    document.getElementById('submit-answer').classList.remove('hidden');
    document.getElementById('next-question').classList.add('hidden');
    document.getElementById('mark-uncertain-test').classList.add('hidden');
    
    if (currentQuestionType === 'multiple-choice') {
        badge.textContent = 'Multiple Choice';
        badge.className = 'question-type-badge mc-badge';
        
        if (showKanji) {
            questionEl.textContent = `What is the English meaning of: ${word.kanji}?`;
        } else {
            questionEl.textContent = `What is the English meaning of: ${word.romaji}?`;
        }
        
        // Generate wrong answers
        const wrongAnswers = vocabulary
            .filter(w => w.kanji !== word.kanji)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(w => w.english);
        
        const allAnswers = shuffleArray([word.english, ...wrongAnswers]);
        
        mcContainer.innerHTML = '';
        allAnswers.forEach(answer => {
            const btn = document.createElement('button');
            btn.className = 'mc-option';
            btn.textContent = answer;
            btn.onclick = () => selectMCOption(btn, answer);
            mcContainer.appendChild(btn);
        });
        
        mcContainer.classList.remove('hidden');
        
    } else { // short-answer-to-english - ALWAYS asks for English translation
        badge.textContent = 'Short Answer';
        badge.className = 'question-type-badge sa-badge';
        
        if (showKanji) {
            questionEl.textContent = `What is the English meaning of: ${word.kanji}?`;
        } else {
            questionEl.textContent = `What is the English meaning of: ${word.romaji}?`;
        }
        
        input.value = '';
        input.placeholder = 'Type English translation...';
        inputContainer.classList.remove('hidden');
        input.focus();
    }
    
    updateTestCounter();
    updateTestProgress();
}

let selectedMCAnswer = null;

function selectMCOption(button, answer) {
    document.querySelectorAll('.mc-option').forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');
    selectedMCAnswer = answer;
}

// Submit Answer
function submitAnswer() {
    const word = currentWords[currentTestIndex];
    let userAnswer = '';
    let isCorrect = false;
    
    if (currentQuestionType === 'multiple-choice') {
        if (!selectedMCAnswer) {
            alert('Please select an answer');
            return;
        }
        userAnswer = selectedMCAnswer;
        isCorrect = userAnswer.toLowerCase() === word.english.toLowerCase();
        
    } else { // short-answer-to-english
        userAnswer = document.getElementById('test-input').value.trim();
        const correctAnswer = word.english.toLowerCase();
        isCorrect = userAnswer.toLowerCase() === correctAnswer || 
                   correctAnswer.split(',').some(ans => ans.trim() === userAnswer.toLowerCase());
    }
    
    const answerStartTime = testStartTime || Date.now();
    const timeTaken = Date.now() - answerStartTime;
    testStartTime = Date.now();
    
    testAnswers.push({
        word: word,
        userAnswer: userAnswer,
        correct: isCorrect,
        timeTaken: timeTaken,
        questionType: currentQuestionType
    });
    
    // Update statistics
    const stats = getWordStats(word.kanji);
    stats.testCount++;
    stats.lastTested = Date.now();
    stats.totalTime += timeTaken;
    
    if (isCorrect) {
        stats.correctCount++;
        stats.consecutiveCorrect++;
    } else {
        stats.incorrectCount++;
        stats.consecutiveCorrect = 0;
    }
    
    saveWordStats(word.kanji, stats);
    
    // Show feedback
    const feedback = document.getElementById('test-feedback');
    feedback.classList.remove('hidden', 'correct', 'incorrect');
    
    if (isCorrect) {
        feedback.classList.add('correct');
        feedback.textContent = '✓ Correct!';
    } else {
        feedback.classList.add('incorrect');
        feedback.textContent = `✗ Incorrect. The answer is: ${word.english}`;
    }
    
    // Highlight correct/incorrect MC options
    if (currentQuestionType === 'multiple-choice') {
        document.querySelectorAll('.mc-option').forEach(btn => {
            btn.disabled = true;
            if (btn.textContent === word.english) {
                btn.classList.add('mc-correct');
            } else if (btn.classList.contains('selected')) {
                btn.classList.add('mc-incorrect');
            }
        });
    }
    
    document.getElementById('submit-answer').classList.add('hidden');
    document.getElementById('next-question').classList.remove('hidden');
    document.getElementById('mark-uncertain-test').classList.remove('hidden');
    selectedMCAnswer = null;
}

// Next Question
function nextQuestion() {
    currentTestIndex++;
    
    if (currentTestIndex < currentWords.length) {
        displayQuestion();
    } else {
        showResults();
    }
}

// Update Test Counter
function updateTestCounter() {
    document.getElementById('test-counter').textContent = 
        `Question ${currentTestIndex + 1} of ${currentWords.length}`;
}

// Update Test Progress
function updateTestProgress() {
    const progress = ((currentTestIndex + 1) / currentWords.length) * 100;
    document.getElementById('test-progress').style.width = progress + '%';
}

// Show Results
function showResults() {
    hideAllSections();
    
    const correctCount = testAnswers.filter(a => a.correct).length;
    const percentage = Math.round((correctCount / testAnswers.length) * 100);
    
    let resultsHTML = `
        <div class="results-summary">
            <h3>Test Complete!</h3>
            <div class="score">${percentage}%</div>
            <p>${correctCount} out of ${testAnswers.length} correct</p>
        </div>
        <div class="results-details">
            <h3>Detailed Results:</h3>
    `;
    
    testAnswers.forEach((answer, index) => {
        const className = answer.correct ? 'correct' : 'incorrect';
        const timeSeconds = (answer.timeTaken / 1000).toFixed(1);
        const typeLabel = answer.questionType === 'multiple-choice' ? 'MC' : 'SA';
        
        resultsHTML += `
            <div class="result-item ${className}">
                <div>
                    <span class="result-type-badge">${typeLabel}</span>
                    <strong>${answer.word.kanji}</strong> (${answer.word.romaji})
                    <br>
                    <small>Your answer: ${answer.userAnswer || '(no answer)'}</small>
                    ${!answer.correct ? `<br><small>Correct: ${answer.word.english}</small>` : ''}
                </div>
                <div>${timeSeconds}s</div>
            </div>
        `;
    });
    
    resultsHTML += '</div>';
    document.getElementById('results-content').innerHTML = resultsHTML;
    document.getElementById('results-section').classList.remove('hidden');
}

// Statistics Functions
function getWordStats(kanji) {
    const allStats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
    return allStats[kanji] || {
        testCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        reviewCount: 0,
        consecutiveCorrect: 0,
        totalTime: 0,
        lastTested: null,
        lastReviewed: null
    };
}

function saveWordStats(kanji, stats) {
    const allStats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
    allStats[kanji] = stats;
    localStorage.setItem(STATS_KEY, JSON.stringify(allStats));
    updateStatsSummary();
}

function loadStatistics() {
    const allStats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
    return allStats;
}

function showStatistics() {
    hideAllSections();
    displayStatistics('all');
    document.getElementById('statistics-section').classList.remove('hidden');
}

function displayStatistics(filter) {
    const allStats = loadStatistics();
    const statsContent = document.getElementById('stats-content');
    
    let statsHTML = '';
    let wordsToShow = [];
    
    vocabulary.forEach(word => {
        const stats = allStats[word.kanji] || null;
        
        if (!stats && filter !== 'all') return;
        
        const masteryLevel = getMasteryLevel(stats);
        
        if (filter === 'all' || 
            (filter === 'mastered' && masteryLevel === 'mastered') ||
            (filter === 'learning' && masteryLevel === 'learning') ||
            (filter === 'difficult' && masteryLevel === 'difficult')) {
            wordsToShow.push({ word, stats, masteryLevel });
        }
    });
    
    if (wordsToShow.length === 0) {
        statsHTML = '<p style="text-align: center; color: #666;">No statistics available for this filter.</p>';
    } else {
        wordsToShow.forEach(({ word, stats, masteryLevel }) => {
            const accuracy = stats && stats.testCount > 0 
                ? Math.round((stats.correctCount / stats.testCount) * 100) 
                : 0;
            const avgTime = stats && stats.testCount > 0
                ? (stats.totalTime / stats.testCount / 1000).toFixed(1)
                : 0;
            
            statsHTML += `
                <div class="stat-item">
                    <h4>
                        ${word.kanji} (${word.romaji}) - ${word.english}
                        <span class="stat-badge ${masteryLevel}">${masteryLevel}</span>
                    </h4>
                    <div class="stat-details">
                        <div>Tests: ${stats ? stats.testCount : 0}</div>
                        <div>Correct: ${stats ? stats.correctCount : 0}</div>
                        <div>Accuracy: ${accuracy}%</div>
                        <div>Avg Time: ${avgTime}s</div>
                        <div>Reviews: ${stats ? stats.reviewCount : 0}</div>
                        <div>Streak: ${stats ? stats.consecutiveCorrect : 0}</div>
                    </div>
                </div>
            `;
        });
    }
    
    statsContent.innerHTML = statsHTML;
}

function getMasteryLevel(stats) {
    if (!stats || stats.testCount === 0) return 'learning';
    
    const accuracy = stats.correctCount / stats.testCount;
    
    if (accuracy >= 0.9 && stats.consecutiveCorrect >= 3) {
        return 'mastered';
    } else if (accuracy < 0.5 || stats.incorrectCount > stats.correctCount) {
        return 'difficult';
    } else {
        return 'learning';
    }
}

function filterStats(filter) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    displayStatistics(filter);
}

function resetStatistics() {
    if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
        localStorage.removeItem(STATS_KEY);
        updateStatsSummary();
        displayStatistics('all');
        alert('All statistics have been reset.');
    }
}

function updateStatsSummary() {
    const allStats = loadStatistics();
    const totalWords = vocabulary.length;
    const testedWords = Object.keys(allStats).length;
    const unfamiliarCount = getUnfamiliarWords().length;
    
    let masteredCount = 0;
    Object.keys(allStats).forEach(kanji => {
        if (getMasteryLevel(allStats[kanji]) === 'mastered') {
            masteredCount++;
        }
    });
    
    document.getElementById('stats-summary').textContent = 
        `${totalWords} words | ${testedWords} tested | ${masteredCount} mastered | ${unfamiliarCount} uncertain`;
}

// Navigation Helpers
function hideAllSections() {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
}

function backToSelection() {
    if (currentMode === 'flashcard' || currentMode === 'unit-test') {
        showUnitSelection();
    } else if (currentMode === 'subset-test') {
        showSubsetSelection();
    }
}
