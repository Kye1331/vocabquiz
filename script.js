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
let currentQuestionType = null; // 'kanji' or 'romaji'

// Statistics Storage Keys
const STATS_KEY = 'japaneseVocabStats';
const UNIT_SCORES_KEY = 'japaneseUnitScores';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadStatistics();
});

// Event Listeners
function initializeEventListeners() {
    // File upload
    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    
    // Mode selection
    document.getElementById('flashcard-btn').addEventListener('click', () => selectMode('flashcard'));
    document.getElementById('unit-test-btn').addEventListener('click', () => selectMode('unit-test'));
    document.getElementById('subset-test-btn').addEventListener('click', () => selectMode('subset-test'));
    document.getElementById('train-weak-btn').addEventListener('click', () => selectMode('train-weak'));
    document.getElementById('review-old-btn').addEventListener('click', () => selectMode('review-old'));
    document.getElementById('stats-btn').addEventListener('click', showStatistics);
    
    // Flashcard controls
    document.getElementById('prev-card').addEventListener('click', () => navigateCard(-1));
    document.getElementById('next-card').addEventListener('click', () => navigateCard(1));
    document.getElementById('flip-card').addEventListener('click', flipCard);
    document.getElementById('flashcard').addEventListener('click', flipCard);
    
    // Difficulty buttons
    document.getElementById('easy-btn').addEventListener('click', () => recordDifficulty('easy'));
    document.getElementById('medium-btn').addEventListener('click', () => recordDifficulty('medium'));
    document.getElementById('hard-btn').addEventListener('click', () => recordDifficulty('hard'));
    
    // Test controls
    document.getElementById('next-question').addEventListener('click', nextQuestion);
    
    // Navigation
    document.getElementById('back-to-mode').addEventListener('click', showModeSelection);
    document.getElementById('exit-flashcard').addEventListener('click', backToSelection);
    document.getElementById('exit-test').addEventListener('click', backToSelection);
    document.getElementById('back-to-selection').addEventListener('click', backToSelection);
    document.getElementById('exit-stats').addEventListener('click', showModeSelection);
    
    // Stats filters
    document.getElementById('filter-all').addEventListener('click', () => filterStats('all'));
    document.getElementById('filter-mastered').addEventListener('click', () => filterStats('mastered'));
    document.getElementById('filter-learning').addEventListener('click', () => filterStats('learning'));
    document.getElementById('filter-difficult').addEventListener('click', () => filterStats('difficult'));
    
    // Reset stats
    document.getElementById('reset-stats-btn').addEventListener('click', resetStatistics);
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
        updateStatsSummary();
    }
}

function removeUnfamiliarWord(kanji) {
    const unfamiliar = getUnfamiliarWords();
    const filtered = unfamiliar.filter(k => k !== kanji);
    localStorage.setItem(UNFAMILIAR_KEY, JSON.stringify(filtered));
    updateStatsSummary();
}

function clearUnfamiliarWords() {
    if (confirm('Are you sure you want to clear all unfamiliar words?')) {
        localStorage.removeItem(UNFAMILIAR_KEY);
        showUnfamiliarWords();
        updateStatsSummary();
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
        content.innerHTML = '<p style="text-align: center; color: #7a7a7a;">No unfamiliar words yet. Mark words as uncertain during study!</p>';
    } else {
        let html = '<div class="unfamiliar-list">';
        unfamiliar.forEach(kanji => {
            const word = vocabulary.find(w => w.kanji === kanji);
            if (word) {
                html += `
                    <div class="stat-item">
                        <h4>${word.kanji} (${word.romaji}) - ${word.english}</h4>
                        <button onclick="removeUnfamiliarWord('${kanji}'); showUnfamiliarWords();" class="action-btn" style="margin-top: 10px;">Remove</button>
                    </div>
                `;
            }
        });
        html += '</div>';
        content.innerHTML = html;
    }
    
    document.getElementById('unfamiliar-section').classList.remove('hidden');
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

// Select Mode
function selectMode(mode) {
    currentMode = mode;
    
    if (mode === 'flashcard' || mode === 'unit-test') {
        showUnitSelection();
    } else if (mode === 'subset-test') {
        showSubsetSelection();
    } else if (mode === 'practice-unfamiliar') {
        startPracticeUnfamiliar();
    }
}

// Practice Unfamiliar Words
function startPracticeUnfamiliar() {
    const unfamiliarKanji = getUnfamiliarWords();
    const allStats = loadStatistics();
    const wordsToPractice = [];
    
    // Add unfamiliar words (top priority)
    unfamiliarKanji.forEach(kanji => {
        const word = vocabulary.find(w => w.kanji === kanji);
        if (word) {
            wordsToPractice.push({ word, priority: 3 });
        }
    });
    
    // Add words with incorrect answers
    vocabulary.forEach(word => {
        const stats = allStats[word.kanji];
        if (stats && stats.incorrectCount > 0 && !unfamiliarKanji.includes(word.kanji)) {
            const priority = stats.incorrectCount - stats.correctCount;
            if (priority > 0) {
                wordsToPractice.push({ word, priority });
            }
        }
    });
    
    if (wordsToPractice.length === 0) {
        alert('No unfamiliar or difficult words found! Try marking some words as uncertain or take some tests first.');
        showModeSelection();
        return;
    }
    
    // Sort by priority (highest first) and take up to 20
    wordsToPractice.sort((a, b) => b.priority - a.priority);
    const selectedWords = wordsToPractice.slice(0, 20).map(item => item.word);
    
    startTest(selectedWords);
}

// Show Mode Selection
function showModeSelection() {
    hideAllSections();
    document.getElementById('mode-selection').classList.remove('hidden');
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
    const unitScores = getUnitScores();
    
    for (let i = 0; i < numUnits; i++) {
        const btn = document.createElement('button');
        const start = i * 50;
        const end = Math.min((i + 1) * 50, vocabulary.length);
        const unitKey = `unit-${i}`;
        const topScore = unitScores[unitKey] || null;
        
        btn.innerHTML = `Unit ${i + 1} (${start + 1}-${end})`;
        if (topScore !== null) {
            btn.innerHTML += `<span class="unit-score">Best: ${topScore}%</span>`;
        }
        
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
    
    const modeText = currentMode === 'subset-test' ? 'Test' : 'Flashcards';
    title.textContent = `Select Subset for ${modeText} (10 words each)`;
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
        startTest(words, unitIndex);
    }
}

// Select Subset
function selectSubset(subsetIndex) {
    currentSubset = subsetIndex;
    const start = subsetIndex * 10;
    const end = Math.min((subsetIndex + 1) * 10, vocabulary.length);
    const words = vocabulary.slice(start, end);
    
    if (currentMode === 'subset-test') {
        startTest(words);
    } else {
        startFlashcards(words);
    }
}

// Train Weak Skills
function startTrainWeak() {
    const allStats = loadStatistics();
    const weakWords = [];
    
    vocabulary.forEach(word => {
        const stats = allStats[word.kanji];
        if (stats && getMasteryLevel(stats) === 'difficult') {
            weakWords.push(word);
        }
    });
    
    if (weakWords.length === 0) {
        alert('No weak words found! Try taking some tests first.');
        showModeSelection();
        return;
    }
    
    // Shuffle and take up to 20 weak words
    const shuffled = weakWords.sort(() => 0.5 - Math.random()).slice(0, 20);
    startTest(shuffled);
}

// Review Old Words
function startReviewOld() {
    const allStats = loadStatistics();
    const oldWords = [];
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    vocabulary.forEach(word => {
        const stats = allStats[word.kanji];
        if (stats && stats.lastTested && stats.lastTested < weekAgo) {
            oldWords.push({ word, lastTested: stats.lastTested });
        }
    });
    
    if (oldWords.length === 0) {
        alert('No old words to review! All words have been tested recently.');
        showModeSelection();
        return;
    }
    
    // Sort by oldest first and take up to 20
    oldWords.sort((a, b) => a.lastTested - b.lastTested);
    const wordsToReview = oldWords.slice(0, 20).map(item => item.word);
    startTest(wordsToReview);
}

// Quick Practice - Random 10 words
function startQuickPractice() {
    const shuffled = [...vocabulary].sort(() => 0.5 - Math.random()).slice(0, 10);
    startTest(shuffled);
}

// Start Flashcards
function startFlashcards(words) {
    hideAllSections();
    currentCardIndex = 0;
    currentWords = words;
    
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
    
    // Update navigation buttons
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
    
    // Move to next card
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

// Start Test (Multiple Choice)
function startTest(words, unitIndex = null) {
    hideAllSections();
    currentTestIndex = 0;
    currentWords = words;
    currentUnit = unitIndex;
    testAnswers = [];
    testStartTime = Date.now();
    
    document.getElementById('test-section').classList.remove('hidden');
    displayQuestion();
}

// Display Question (Multiple Choice)
function displayQuestion() {
    const word = currentWords[currentTestIndex];
    
    // Randomly choose to test kanji or romaji
    currentQuestionType = Math.random() < 0.5 ? 'kanji' : 'romaji';
    
    const questionText = currentQuestionType === 'kanji' 
        ? `What is the English meaning of: ${word.kanji}`
        : `What is the English meaning of: ${word.romaji}`;
    
    document.getElementById('test-question').textContent = questionText;
    
    // Generate multiple choice options
    const choices = generateChoices(word);
    const choicesContainer = document.getElementById('test-choices');
    choicesContainer.innerHTML = '';
    
    choices.forEach((choice, index) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = choice;
        btn.addEventListener('click', () => selectAnswer(choice, word.english, btn));
        choicesContainer.appendChild(btn);
    });
    
    document.getElementById('test-feedback').classList.add('hidden');
    document.getElementById('next-question').classList.add('hidden');
    document.getElementById('unfamiliar-btn').classList.remove('hidden');
    document.getElementById('unfamiliar-btn').disabled = false;
    
    updateTestCounter();
    updateTestProgress();
}

// Generate Multiple Choice Options
function generateChoices(correctWord) {
    const choices = [correctWord.english];
    const usedIndices = new Set([currentWords.indexOf(correctWord)]);
    
    // Get 3 random wrong answers from vocabulary
    while (choices.length < 4) {
        const randomIndex = Math.floor(Math.random() * vocabulary.length);
        if (!usedIndices.has(randomIndex)) {
            choices.push(vocabulary[randomIndex].english);
            usedIndices.add(randomIndex);
        }
    }
    
    // Shuffle choices
    return choices.sort(() => Math.random() - 0.5);
}

// Select Answer
function selectAnswer(selectedAnswer, correctAnswer, button) {
    const word = currentWords[currentTestIndex];
    const answerStartTime = testStartTime || Date.now();
    const timeTaken = Date.now() - answerStartTime;
    testStartTime = Date.now();
    
    // Normalize answers for comparison
    const isCorrect = selectedAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    
    testAnswers.push({
        word: word,
        userAnswer: selectedAnswer,
        correct: isCorrect,
        timeTaken: timeTaken,
        questionType: currentQuestionType,
        unfamiliar: false
    });
    
    // Track incorrect words for retry feature
    if (!isCorrect) {
        incorrectWords.push(word);
    }
    
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
    
    // Disable all buttons and show feedback
    const allButtons = document.querySelectorAll('.choice-btn');
    allButtons.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === correctAnswer) {
            btn.classList.add('correct');
        }
    });
    
    if (isCorrect) {
        button.classList.add('selected');
    } else {
        button.classList.add('incorrect');
    }
    
    // Show feedback
    const feedback = document.getElementById('test-feedback');
    feedback.classList.remove('hidden', 'correct', 'incorrect');
    
    if (isCorrect) {
        feedback.classList.add('correct');
        feedback.textContent = '✓ Correct!';
    } else {
        feedback.classList.add('incorrect');
        feedback.textContent = `✗ Incorrect. The answer is: ${correctAnswer}`;
    }
    
    document.getElementById('unfamiliar-btn').classList.add('hidden');
    document.getElementById('next-question').classList.remove('hidden');
}

// Mark as Unfamiliar
function markUnfamiliar() {
    const word = currentWords[currentTestIndex];
    const timeTaken = Date.now() - (testStartTime || Date.now());
    
    testAnswers.push({
        word: word,
        userAnswer: 'unfamiliar',
        correct: false,
        timeTaken: timeTaken,
        questionType: currentQuestionType,
        unfamiliar: true
    });
    
    incorrectWords.push(word);
    
    // Update statistics - mark as unfamiliar
    const stats = getWordStats(word.kanji);
    stats.testCount++;
    stats.lastTested = Date.now();
    stats.incorrectCount++;
    stats.consecutiveCorrect = 0;
    stats.unfamiliar = true;
    
    saveWordStats(word.kanji, stats);
    
    // Show the correct answer
    const allButtons = document.querySelectorAll('.choice-btn');
    allButtons.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === word.english) {
            btn.classList.add('correct');
        }
    });
    
    const feedback = document.getElementById('test-feedback');
    feedback.classList.remove('hidden');
    feedback.classList.add('incorrect');
    feedback.textContent = `The correct answer is: ${word.english} (${word.kanji} - ${word.romaji})`;
    
    document.getElementById('unfamiliar-btn').disabled = true;
    document.getElementById('next-question').classList.remove('hidden');
}

// Next Question
function nextQuestion() {
    currentTestIndex++;
    document.getElementById('override-correct').classList.add('hidden');
    canOverride = false;
    
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
    
    // Save unit score if this was a unit test
    if (currentUnit !== null && currentMode === 'unit-test') {
        saveUnitScore(currentUnit, percentage);
    }
    
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
        const questionDisplay = answer.questionType === 'kanji' ? answer.word.kanji : answer.word.romaji;
        const typeLabel = answer.questionType === 'multiple-choice' ? 'MC' : 'SA';
        const overrideNote = answer.wasOverridden ? ' (overridden)' : '';
        
        resultsHTML += `
            <div class="result-item ${className}">
                <div>
                    <span class="result-type-badge">${typeLabel}</span>
                    <strong>${answer.word.kanji}</strong> (${answer.word.romaji})
                    <br>
                    <small>Your answer: ${answer.userAnswer}${overrideNote}</small>
                    ${!answer.correct && !answer.wasOverridden ? `<br><small>Correct: ${answer.word.english}</small>` : ''}
                </div>
                <div>${timeSeconds}s</div>
            </div>
        `;
    });
    
    resultsHTML += '</div>';
    document.getElementById('results-content').innerHTML = resultsHTML;
    document.getElementById('results-section').classList.remove('hidden');
}

// Unit Score Functions
function getUnitScores() {
    return JSON.parse(localStorage.getItem(UNIT_SCORES_KEY) || '{}');
}

function saveUnitScore(unitIndex, percentage) {
    const scores = getUnitScores();
    const unitKey = `unit-${unitIndex}`;
    
    if (!scores[unitKey] || percentage > scores[unitKey]) {
        scores[unitKey] = percentage;
        localStorage.setItem(UNIT_SCORES_KEY, JSON.stringify(scores));
    }
}

// Unit Score Functions
function getUnitScores() {
    return JSON.parse(localStorage.getItem(UNIT_SCORES_KEY) || '{}');
}

function saveUnitScore(unitIndex, percentage) {
    const scores = getUnitScores();
    const unitKey = `unit-${unitIndex}`;
    
    if (!scores[unitKey] || percentage > scores[unitKey]) {
        scores[unitKey] = percentage;
        localStorage.setItem(UNIT_SCORES_KEY, JSON.stringify(scores));
    }
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
        lastReviewed: null,
        unfamiliar: false
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
    updateStatsSummaryCards();
    document.getElementById('statistics-section').classList.remove('hidden');
}

function updateStatsSummaryCards() {
    const allStats = loadStatistics();
    const testedWords = Object.keys(allStats).length;
    
    let masteredCount = 0;
    let totalCorrect = 0;
    let totalTests = 0;
    
    Object.keys(allStats).forEach(kanji => {
        const stats = allStats[kanji];
        if (getMasteryLevel(stats) === 'mastered') {
            masteredCount++;
        }
        totalCorrect += stats.correctCount;
        totalTests += stats.testCount;
    });
    
    const accuracyRate = totalTests > 0 ? Math.round((totalCorrect / totalTests) * 100) : 0;
    const streak = getStudyStreak();
    
    document.getElementById('total-studied').textContent = testedWords;
    document.getElementById('total-mastered').textContent = masteredCount;
    document.getElementById('accuracy-rate').textContent = accuracyRate + '%';
    document.getElementById('study-streak').textContent = streak;
}

function displayStatistics(filter) {
    const allStats = loadStatistics();
    const statsContent = document.getElementById('stats-content');
    const searchQuery = document.getElementById('word-search').value.toLowerCase();
    
    let statsHTML = '';
    let wordsToShow = [];
    
    vocabulary.forEach(word => {
        const stats = allStats[word.kanji] || null;
        
        // Apply search filter
        if (searchQuery && 
            !word.kanji.toLowerCase().includes(searchQuery) &&
            !word.romaji.toLowerCase().includes(searchQuery) &&
            !word.english.toLowerCase().includes(searchQuery)) {
            return;
        }
        
        if (!stats && filter !== 'all') return;
        
        const masteryLevel = getMasteryLevel(stats);
        const isUnfamiliar = stats && stats.unfamiliar;
        
        if (filter === 'all' || 
            (filter === 'mastered' && masteryLevel === 'mastered') ||
            (filter === 'learning' && masteryLevel === 'learning') ||
            (filter === 'difficult' && masteryLevel === 'difficult') ||
            (filter === 'unfamiliar' && isUnfamiliar)) {
            wordsToShow.push({ word, stats, masteryLevel });
        }
    });
    
    if (wordsToShow.length === 0) {
        statsHTML = '<p style="text-align: center; color: #7a7a7a;">No words match your search.</p>';
    } else {
        wordsToShow.forEach(({ word, stats, masteryLevel }) => {
            const accuracy = stats && stats.testCount > 0 
                ? Math.round((stats.correctCount / stats.testCount) * 100) 
                : 0;
            const avgTime = stats && stats.testCount > 0
                ? (stats.totalTime / stats.testCount / 1000).toFixed(1)
                : 0;
            
            const unfamiliarBadge = stats && stats.unfamiliar 
                ? '<span class="stat-badge unfamiliar">unfamiliar</span>' 
                : '';
            
            statsHTML += `
                <div class="stat-item">
                    <h4>
                        ${word.kanji} (${word.romaji}) - ${word.english}
                        <span class="stat-badge ${masteryLevel}">${masteryLevel}</span>
                        ${unfamiliarBadge}
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

function searchWords() {
    const activeFilter = document.querySelector('.filter-btn.active');
    const filter = activeFilter ? activeFilter.id.replace('filter-', '') : 'all';
    displayStatistics(filter);
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
        localStorage.removeItem(UNIT_SCORES_KEY);
        localStorage.removeItem(STREAK_KEY);
        updateStatsSummary();
        updateStatsSummaryCards();
        displayStatistics('all');
        alert('All statistics have been reset.');
    }
}

function exportStatistics() {
    const allStats = loadStatistics();
    const exportData = [];
    
    vocabulary.forEach(word => {
        const stats = allStats[word.kanji];
        if (stats) {
            exportData.push({
                kanji: word.kanji,
                romaji: word.romaji,
                english: word.english,
                testCount: stats.testCount,
                correctCount: stats.correctCount,
                incorrectCount: stats.incorrectCount,
                accuracy: stats.testCount > 0 ? Math.round((stats.correctCount / stats.testCount) * 100) : 0,
                masteryLevel: getMasteryLevel(stats),
                unfamiliar: stats.unfamiliar || false
            });
        }
    });
    
    const csv = convertToCSV(exportData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocabulary-stats-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).join(','));
    return headers + '\n' + rows.join('\n');
}

// Study Streak Functions
function getStudyStreak() {
    const streakData = JSON.parse(localStorage.getItem(STREAK_KEY) || '{"lastStudy": null, "streak": 0}');
    return streakData.streak;
}

function updateStudyStreak() {
    const streakData = JSON.parse(localStorage.getItem(STREAK_KEY) || '{"lastStudy": null, "streak": 0}');
    const today = new Date().toDateString();
    const lastStudy = streakData.lastStudy ? new Date(streakData.lastStudy).toDateString() : null;
    
    if (lastStudy !== today) {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
        
        if (lastStudy === yesterday) {
            streakData.streak++;
        } else if (lastStudy === null) {
            streakData.streak = 1;
        } else {
            streakData.streak = 1;
        }
        
        streakData.lastStudy = new Date().toISOString();
        localStorage.setItem(STREAK_KEY, JSON.stringify(streakData));
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

// Randomize array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Navigation Helpers
function hideAllSections() {
    document.querySelectorAll('.section').forEach(section => {
        if (section.id !== 'upload-section') {
            section.classList.add('hidden');
        }
    });
}

function backToSelection() {
    if (currentMode === 'flashcard' || currentMode === 'unit-test') {
        showUnitSelection();
    } else if (currentMode === 'subset-test') {
        showSubsetSelection();
    } else {
        showModeSelection();
    }
}
