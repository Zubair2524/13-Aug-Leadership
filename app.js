// Supabase Configuration
const projectUrl = 'https://nfwuztbyvbasaqbpyojr.supabase.co';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5md3V6dGJ5dmJhc2FxYnB5b2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNjQ4NzcsImV4cCI6MjA3MDY0MDg3N30.DhEvb6H9kczxdD1N9_d6DmDkk6_9sUGZfKSFk7hYLdQ';

// Application State
let currentUser = null;
let assessmentStatements = [];
let currentQuestionIndex = 0;
let responses = [];
let usedStatementIds = [];

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        // Check if user exists in localStorage
        const savedUser = localStorage.getItem('leadershipAssessmentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            // Check if user exists in database and has completed assessment
            const userExists = await checkUserInDatabase(currentUser.fullName);
            if (userExists && userExists.assessment_completed) {
                // User has completed assessment, show results
                displayResults(userExists);
                return;
            } else if (userExists) {
                // User exists but hasn't completed assessment
                currentUser = userExists;
                startAssessment();
                return;
            }
        }
        
        // Show welcome page for new users
        showPage('welcomePage');
    } catch (error) {
        console.error('Error initializing app:', error);
        showPage('welcomePage');
    }
}

// Supabase API Functions
async function checkUserInDatabase(fullName) {
    try {
        const response = await fetch(`${projectUrl}/rest/v1/users?full_name=eq.${encodeURIComponent(fullName)}`, {
            method: 'GET',
            headers: {
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            return users.length > 0 ? users[0] : null;
        }
        return null;
    } catch (error) {
        console.error('Error checking user in database:', error);
        return null;
    }
}

async function saveUserToDatabase(userData) {
    try {
        const response = await fetch(`${projectUrl}/rest/v1/users`, {
            method: 'POST',
            headers: {
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(userData)
        });
        
        if (response.ok) {
            const result = await response.json();
            return result[0];
        } else {
            throw new Error('Failed to save user');
        }
    } catch (error) {
        console.error('Error saving user to database:', error);
        throw error;
    }
}

async function updateUserAssessment(userId, assessmentData) {
    try {
        const response = await fetch(`${projectUrl}/rest/v1/users?id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(assessmentData)
        });
        
        if (response.ok) {
            const result = await response.json();
            return result[0];
        } else {
            throw new Error('Failed to update user assessment');
        }
    } catch (error) {
        console.error('Error updating user assessment:', error);
        throw error;
    }
}

// Page Management
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show target page
    document.getElementById(pageId).classList.add('active');
}

// Welcome Page Handler
document.getElementById('userForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = {
        full_name: formData.get('fullName'),
        designation: formData.get('designation'),
        team: formData.get('team'),
        city: formData.get('city'),
        assessment_completed: false,
        created_at: new Date().toISOString()
    };
    
    try {
        // Check if user already exists
        const existingUser = await checkUserInDatabase(userData.full_name);
        
        if (existingUser) {
            currentUser = existingUser;
            if (existingUser.assessment_completed) {
                displayResults(existingUser);
                return;
            }
        } else {
            // Save new user to database
            currentUser = await saveUserToDatabase(userData);
        }
        
        // Save user to localStorage
        localStorage.setItem('leadershipAssessmentUser', JSON.stringify(currentUser));
        
        // Start assessment
        startAssessment();
        
    } catch (error) {
        console.error('Error processing user data:', error);
        alert('There was an error processing your information. Please try again.');
    }
});

// Assessment Functions
function startAssessment() {
    // Get random statements for assessment
    assessmentStatements = getRandomStatements(25);
    currentQuestionIndex = 0;
    responses = [];
    usedStatementIds = [];
    
    // Update user display
    document.getElementById('userNameDisplay').textContent = currentUser.full_name;
    
    // Show first question
    displayQuestion();
    
    // Show assessment page
    showPage('assessmentPage');
}

function displayQuestion() {
    const statement = assessmentStatements[currentQuestionIndex];
    
    // Update question display
    document.getElementById('questionNumber').textContent = currentQuestionIndex + 1;
    document.getElementById('statementText').textContent = statement.text;
    
    // Update progress
    const progress = ((currentQuestionIndex + 1) / 25) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = `${currentQuestionIndex + 1} / 25`;
    
    // Add event listeners to option buttons
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.onclick = () => selectOption(parseInt(btn.dataset.value));
    });
}

function selectOption(value) {
    const statement = assessmentStatements[currentQuestionIndex];
    
    // Store response
    responses.push({
        statementId: statement.id,
        style: statement.style,
        value: value
    });
    
    // Add to used statements
    usedStatementIds.push(statement.id);
    
    // Move to next question or finish
    currentQuestionIndex++;
    
    if (currentQuestionIndex < 25) {
        // Check if we need more statements
        if (currentQuestionIndex >= assessmentStatements.length) {
            // Get more statements excluding used ones
            const availableStatements = leadershipStatements.filter(s => !usedStatementIds.includes(s.id));
            const additionalStatements = availableStatements.sort(() => 0.5 - Math.random()).slice(0, 25 - assessmentStatements.length);
            assessmentStatements.push(...additionalStatements);
        }
        
        setTimeout(() => {
            displayQuestion();
        }, 300);
    } else {
        // Assessment complete
        setTimeout(() => {
            completeAssessment();
        }, 300);
    }
}

async function completeAssessment() {
    // Calculate scores
    const scores = calculateScores();
    
    // Prepare assessment data
    const assessmentData = {
        assessment_completed: true,
        coercive_score: scores.coercive,
        authoritative_score: scores.authoritative,
        affiliative_score: scores.affiliative,
        democratic_score: scores.democratic,
        pacesetting_score: scores.pacesetting,
        coaching_score: scores.coaching,
        primary_style: scores.primaryStyle,
        completed_at: new Date().toISOString()
    };
    
    try {
        // Update user in database
        const updatedUser = await updateUserAssessment(currentUser.id, assessmentData);
        currentUser = updatedUser;
        
        // Update localStorage
        localStorage.setItem('leadershipAssessmentUser', JSON.stringify(currentUser));
        
        // Display results
        displayResults(currentUser);
        
    } catch (error) {
        console.error('Error saving assessment results:', error);
        // Still show results even if save failed
        displayResults({ ...currentUser, ...assessmentData });
    }
}

function calculateScores() {
    const styleScores = {
        coercive: 0,
        authoritative: 0,
        affiliative: 0,
        democratic: 0,
        pacesetting: 0,
        coaching: 0
    };
    
    const styleCounts = {
        coercive: 0,
        authoritative: 0,
        affiliative: 0,
        democratic: 0,
        pacesetting: 0,
        coaching: 0
    };
    
    // Calculate total scores for each style
    responses.forEach(response => {
        styleScores[response.style] += response.value;
        styleCounts[response.style]++;
    });
    
    // Calculate percentages
    const percentages = {};
    let maxScore = 0;
    let primaryStyle = '';
    
    Object.keys(styleScores).forEach(style => {
        if (styleCounts[style] > 0) {
            const maxPossible = styleCounts[style] * 5; // Maximum possible score
            percentages[style] = Math.round((styleScores[style] / maxPossible) * 100);
            
            if (percentages[style] > maxScore) {
                maxScore = percentages[style];
                primaryStyle = style;
            }
        } else {
            percentages[style] = 0;
        }
    });
    
    return {
        ...percentages,
        primaryStyle: primaryStyle
    };
}

function displayResults(userData) {
    // Update user name
    document.getElementById('userNameResults').textContent = userData.full_name;
    
    // Get primary style info
    const primaryStyleInfo = leadershipStyles[userData.primary_style];
    
    // Update primary style display
    document.getElementById('primaryStyleName').textContent = primaryStyleInfo.name;
    document.getElementById('primaryStylePercentage').textContent = `${userData[userData.primary_style + '_score']}%`;
    document.getElementById('primaryStyleDescription').textContent = primaryStyleInfo.description;
    
    // Display all styles
    displayAllStyles(userData);
    
    // Update certificate
    updateCertificate(userData);
    
    // Show results page
    showPage('resultsPage');
}

function displayAllStyles(userData) {
    const stylesGrid = document.getElementById('stylesGrid');
    stylesGrid.innerHTML = '';
    
    const styles = ['coercive', 'authoritative', 'affiliative', 'democratic', 'pacesetting', 'coaching'];
    
    styles.forEach(style => {
        const styleInfo = leadershipStyles[style];
        const score = userData[style + '_score'];
        
        const styleElement = document.createElement('div');
        styleElement.className = 'style-item';
        styleElement.innerHTML = `
            <div class="style-header">
                <div class="style-name">${styleInfo.name}</div>
                <div class="style-percentage">${score}%</div>
            </div>
            <div class="style-bar">
                <div class="style-fill" style="width: ${score}%"></div>
            </div>
            <div class="style-description">${styleInfo.description}</div>
        `;
        
        stylesGrid.appendChild(styleElement);
    });
}

function updateCertificate(userData) {
    const primaryStyleInfo = leadershipStyles[userData.primary_style];
    
    document.getElementById('certificateName').textContent = userData.full_name;
    document.getElementById('certificateStyle').textContent = `${primaryStyleInfo.name} Leadership`;
    document.getElementById('certificateScore').textContent = `${userData[userData.primary_style + '_score']}%`;
    
    // Set current date
    const currentDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
    });
    document.getElementById('certificateDate').textContent = currentDate;
}

// Utility Functions
function printCertificate() {
    window.print();
}

function restartAssessment() {
    // Clear user data
    localStorage.removeItem('leadershipAssessmentUser');
    currentUser = null;
    
    // Reset assessment state
    assessmentStatements = [];
    currentQuestionIndex = 0;
    responses = [];
    usedStatementIds = [];
    
    // Show welcome page
    showPage('welcomePage');
    
    // Clear form
    document.getElementById('userForm').reset();
}

// Add smooth scrolling and animations
document.addEventListener('DOMContentLoaded', function() {
    // Add entrance animations to elements
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    document.querySelectorAll('.glassmorphic').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Add keyboard navigation
document.addEventListener('keydown', function(e) {
    if (document.getElementById('assessmentPage').classList.contains('active')) {
        const key = e.key;
        if (key >= '1' && key <= '5') {
            const value = parseInt(key);
            selectOption(6 - value); // Reverse order (1 = Never, 5 = Always)
        }
    }
});

// Add touch gestures for mobile
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', function(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
        if (document.getElementById('assessmentPage').classList.contains('active')) {
            // Add visual feedback for swipe
            const assessmentCard = document.querySelector('.assessment-card');
            assessmentCard.style.transform = diff > 0 ? 'translateX(-10px)' : 'translateX(10px)';
            setTimeout(() => {
                assessmentCard.style.transform = 'translateX(0)';
            }, 200);
        }
    }
}