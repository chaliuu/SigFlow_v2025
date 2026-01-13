const baseUrl = window.location.origin;

console.log('Loaded script')

const json = {
    name: "untitled",
    netlist: null,
    op_point_log: null,
    schematic: null
}

let sfgFile = null;

const form = document.getElementById('uploadForm');



const tutorialModal = document.getElementById("tutorial-modal");
const tutorialIcon = document.getElementById("tutorial-icon");

let currentStep = 0;
const tutorialSteps = [
    {
        title: "Step 1: Circuit File Upload",
        content: "Upload your circuit file here.",
    },
    {
        title: "Step 2: Schematic File Upload",
        content: "Upload your schematic file here.",
    },
    {
        title: "Step 3: Operating Point Log File Upload",
        content: "Upload your operating point log file here.",
    }
    // Add more steps as needed
];



function showStep(stepIndex) {
    if (stepIndex < tutorialSteps.length) {
        const step = tutorialSteps[stepIndex];
        const modalContent = tutorialModal.querySelector(".modal-content");
        modalContent.innerHTML = `
            <button id="close-button" class="close-button">&times;</button>
            <h2>${step.title}</h2>
            <p>${step.content}</p>
            <button id="next-button">Next</button>
        `;

        const nextButton = modalContent.querySelector("#next-button");
        const closeButton = modalContent.querySelector("#close-button");

        nextButton.addEventListener("click", function () {
            console.log("next button clicked");
            currentStep++;
            showStep(currentStep);
        });

        closeButton.addEventListener("click", function () {
            console.log("close button clicked");
            tutorialModal.style.display = "none";
            currentStep = 0; // Reset to the first step
        });

        tutorialModal.style.display = "block";
    } else {
        tutorialModal.style.display = "none";
        alert("Demo completed!");
    }
}



tutorialIcon.addEventListener("click", function() {
    console.log("icon clicked");
    currentStep = 0;
    showStep(currentStep);
});



form.addEventListener('submit', async function(event) {
    event.preventDefault();
    console.log('Uploading circuit');
    console.log(json);

    const hasNetlist = Boolean(json.netlist);
    const hasSfg = Boolean(sfgFile);

    if (!hasNetlist && !hasSfg) {
        alert('Please upload a netlist or an SFG file.');
        return;
    }

    try {
        let circuitId = null;

        if (!hasNetlist && hasSfg) {
            const generatedId = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}`;
            const importUrl = new URL(`${baseUrl}/circuits/${generatedId}/import`);
            const formData = new FormData();
            formData.append('file', sfgFile);

            const importResponse = await fetch(importUrl, {
                method: 'POST',
                body: formData
            });

            if (!importResponse.ok) {
                throw new Error('Failed to import SFG');
            }

            const importedCircuit = await importResponse.json();
            circuitId = importedCircuit.id || generatedId;
            console.log(`Imported SFG into circuit with id: ${circuitId}`);
        } else {
            const response = await fetch(`${baseUrl}/circuits`,
            {
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                mode: 'cors', // no-cors, *cors, same-origin
                cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
                credentials: 'same-origin', // include, *same-origin, omit
                headers: {
                'Content-Type': 'application/json'
                // 'Content-Type': 'application/x-www-form-urlencoded',
                },
                redirect: 'follow', // manual, *follow, error
                referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
                body: JSON.stringify(json) // body data type must match "Content-Type" header
            });

            if (!response.ok) {
                throw new Error('Failed to create circuit');
            }

            const obj = await response.json();
            circuitId = obj.id;
            console.log(obj);
            console.log(`Created circuit with id: ${circuitId}`);

            if (sfgFile) {
                const importUrl = new URL(`${baseUrl}/circuits/${circuitId}/import`);
                const formData = new FormData();
                formData.append('file', sfgFile);

                const importResponse = await fetch(importUrl, {
                    method: 'POST',
                    body: formData
                });

                if (!importResponse.ok) {
                    throw new Error('Failed to import SFG');
                }
            }
        }

        sessionStorage.setItem('circuitId', circuitId);
        window.location.replace('./demo.html');
    } catch (error) {
        console.error(error);
        alert('Failed to upload circuit or SFG.')
    }
})



console.log('Initialized null json to be sent');
console.log(json);


const netlistFile = document.getElementById('formControlNetlistFile');
netlistFile.addEventListener('change', event => {
    const file = event.target.files[0];

    const reader = new FileReader();

    reader.readAsText(file, 'utf-8');

    reader.onerror = function(event) {
        alert("Failed to read file!\n\n" + reader.error);
        reader.abort(); // (...does this do anything useful in an onerror handler?)
      };

    reader.onload = () => {
        const ext = file.name.match(/\.[0-9a-z]+$/i)[0].toLowerCase();
        console.log(`Succesfully read ${ext} file`);

        json.netlist = reader.result;
       
    }
});

const schematicFile = document.getElementById('formControlSchematicFile');
schematicFile.addEventListener('change', event => {
    const file = event.target.files[0];

    const reader = new FileReader();

    reader.readAsText(file, 'utf-8');

    reader.onerror = function(event) {
        alert("Failed to read file!\n\n" + reader.error);
        reader.abort(); // (...does this do anything useful in an onerror handler?)
      };

    reader.onload = () => {
        const ext = file.name.match(/\.[0-9a-z]+$/i)[0].toLowerCase();
        console.log(`Succesfully read ${ext} file`);

        json.schematic = reader.result;
    }
});


const opPointLogFile = document.getElementById('formControlOpLogFile');
opPointLogFile.addEventListener('change', event => {
    const file = event.target.files[0];

    //Read as ArrayBuffer first to detect encoding
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);

    reader.onerror = function(event) 
    {
        alert("Failed to read file!\n\n" + reader.error);
        reader.abort();
    };

    reader.onload = () => {
        const buffer = reader.result;
        const bytes = new Uint8Array(buffer);
        
        let text;
        const hasUtf16LeBom = bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE;
        const hasUtf16BeBom = bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF;
        const looksLikeUtf16Le = bytes.length >= 4 && bytes[1] === 0x00 && bytes[3] === 0x00;
        
        if (hasUtf16LeBom || looksLikeUtf16Le) 
        {
            //UTF-16 Little Endian
            const decoder = new TextDecoder('utf-16le');
            text = decoder.decode(buffer);
            console.log('Detected UTF-16 LE encoding for .log file');
        } else if (hasUtf16BeBom) 
        {
            //UTF-16 Big Endian
            const decoder = new TextDecoder('utf-16be');
            text = decoder.decode(buffer);
            console.log('Detected UTF-16 BE encoding for .log file');
        } else 
        {
            //Default to UTF-8
            const decoder = new TextDecoder('utf-8');
            text = decoder.decode(buffer);
            console.log('Using UTF-8 encoding for .log file');
        }
        
        console.log(`Successfully read .log file`);
        json.op_point_log = text;
    };
});

const sfgUpload = document.getElementById('formControlSfgFile');
sfgUpload.addEventListener('change', event => {
    sfgFile = event.target.files[0] || null;
});
    
