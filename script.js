// Global State
let vocabulary = [];
let currentMode = null;
let currentUnit = null;
let currentSubset = null;
let currentCardIndex = 0;
let currentTestIndex = 0;
let testAnswers = [];
let testStartTime = null;

// Statistics Storage Key
const STATS_KEY = 'japaneseVocabStats';

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
    document.getElementById('submit-answer').addEventListener('click', submitAnswer);
    document.getElementById('next-question').addEventListener('click', nextQuestion);
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
    
    // Stats filters
    document.getElementById('filter-all').addEventListener('click', () => filterStats('all'));
    document.getElementById('filter-mastered').addEventListener('click', () => filterStats('mastered'));
    document.getElementById('filter-learning').addEventListener('click', () => filterStats('learning'));
    document.getElementById('filter-difficult').addEventListener('click', () => filterStats('difficult'));
    
    // Reset stats
    document.getElementById('reset-stats-btn').addEventListener('click', resetStatistics);
}

// File Upload Handler
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        parseVocabulary(e.target.result);
        showModeSelection();
    };
    reader.readAsText(file);
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

// Start Test
function startTest(words) {
    hideAllSections();
    currentTestIndex = 0;
    currentWords = words;
    testAnswers = [];
    testStartTime = Date.now();
    
    document.getElementById('test-section').classList.remove('hidden');
    displayQuestion();
}

// Display Question
function displayQuestion() {
    const word = currentWords[currentTestIndex];
    document.getElementById('test-question').textContent = `What is the English meaning of: ${word.kanji} (${word.romaji})?`;
    document.getElementById('test-input').value = '';
    document.getElementById('test-feedback').classList.add('hidden');
    document.getElementById('submit-answer').classList.remove('hidden');
    document.getElementById('next-question').classList.add('hidden');
    document.getElementById('test-input').focus();
    
    updateTestCounter();
    updateTestProgress();
}

// Submit Answer
function submitAnswer() {
    const word = currentWords[currentTestIndex];
    const userAnswer = document.getElementById('test-input').value.trim().toLowerCase();
    const correctAnswer = word.english.toLowerCase();
    
    const answerStartTime = testStartTime || Date.now();
    const timeTaken = Date.now() - answerStartTime;
    testStartTime = Date.now();
    
    const isCorrect = userAnswer === correctAnswer || 
                     correctAnswer.split(',').some(ans => ans.trim() === userAnswer);
    
    testAnswers.push({
        word: word,
        userAnswer: userAnswer,
        correct: isCorrect,
        timeTaken: timeTaken
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
    
    document.getElementById('submit-answer').classList.add('hidden');
    document.getElementById('next-question').classList.remove('hidden');
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
        resultsHTML += `
            <div class="result-item ${className}">
                <div>
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
    
    let masteredCount = 0;
    Object.keys(allStats).forEach(kanji => {
        if (getMasteryLevel(allStats[kanji]) === 'mastered') {
            masteredCount++;
        }
    });
    
    document.getElementById('stats-summary').textContent = 
        `${totalWords} words loaded | ${testedWords} tested | ${masteredCount} mastered`;
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
    }
}

// Current words being studied
let currentWords = [];
