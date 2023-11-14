document.head.insertAdjacentHTML("beforeend", '<style>.labelEdit { background-color: #f0f0f0; border: 1px solid #ccc; padding: 0 0.5em; white-space: normal; }</style>');
localStorage.flag__originalBankLabel = "true";

function firefox(o) {
    return "wrappedJSObject" in o ? o.wrappedJSObject : o;
}

async function sendUpdate(object) {
    const cozyClient = firefox(window).cozyClient;
    return (await cozyClient.save(object)).data;
}

function makeEditable(label, handler) {
    let editing = false;

    let onclick = function() {
        if (!editing) {
            editing = true;
            label.classList.add("labelEdit");

            const a = document.createElement("a");
            a.href = "#";
            a.innerHTML = '<svg viewBox="0 0 16 16" class="u-ml-half u-coolGrey" width="16" height="16"><path fill="currentColor" d="M6.5 12.5l-4-4 1.4-1.4 2.6 2.6 6.6-6.6 1.4 1.4-8 8z"></path></svg>';

            function keyPressed(e) {
                if (e.keyCode === 13) {
                    e.preventDefault();
                    doUpdate();
                }
            }

            function doUpdate() {
                label.classList.remove("labelEdit");
                label.removeEventListener("blur", doUpdate);
                label.removeEventListener("keydown", keyPressed);
                label.contentEditable = false;
                editing = false;
                a.parentNode.removeChild(a);
                handler(label.innerText);
            }

            a.addEventListener("click", function(e) {
                e.preventDefault();
                doUpdate();
            });

            label.parentNode.insertBefore(a, label.nextSibling);

            label.contentEditable = true;
            label.focus();

            label.addEventListener("blur", doUpdate);
            label.addEventListener("keydown", keyPressed);
        }
    };

    label.addEventListener("click", onclick);
}

const observer = new MutationObserver(function(mutations) {
    for (let mutation of mutations) {
        for (let node of mutation.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            if (node.tagName === 'DIV' && node.getAttribute('role') === 'presentation') {
                const innerDiv = node.querySelector("div[role='none presentation']");
                const opLabel = innerDiv.querySelector("h6");
                // sanity check
                if (!opLabel) continue;
                const a = opLabel.nextElementSibling;
                if (a.tagName !== 'A') continue;
                if (a.querySelector("svg") === null) continue;
                const opAmount = innerDiv.querySelector("span[class*='Figure-total']");
                if (!opAmount) continue;

                let reactDiv = firefox(innerDiv);
                let reactDataKey = Object.keys(reactDiv).find(key => key.startsWith("__reactInternalInstance$"));
                let reactInstance = reactDiv[reactDataKey];
                let transaction = reactInstance.alternate.lastEffect.memoizedProps.transaction;

                if (transaction._type !== "io.cozy.bank.operations") continue;

                function bind(field, fct) {
                    makeEditable(field, newVal => {
                        let old = JSON.stringify(transaction);
                        fct(newVal);
                        if (old !== JSON.stringify(transaction))
                            sendUpdate(transaction).then((t) => transaction = t);
                    });
                }

                bind(opLabel, lbl => {
                    transaction.label = lbl;
                });

                bind(opAmount, amount => {
                    transaction.amount = parseFloat(amount.replace(/,/g, '.').replace(/[^0-9.-]+/g, ""));
                });

                return;
            }
        }
    }
});

observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener('hashchange', function() {
    checkHash();
});

function checkHash() {
    const buttonId = "bcAddButton";
    const button = document.getElementById(buttonId);

    const showButton = location.hash === '#/balances/details';

    if (showButton) {
        if (!button) {
            const buttonsSpan = document.querySelector("span[class*='SelectDates__buttons']");
            const normalButton = buttonsSpan.lastElementChild;

            const svgIcon = normalButton.firstElementChild.cloneNode(true);
            svgIcon.innerHTML = '<path fill="currentColor" d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zM9 9V5H7v4H3v2h4v4h2v-4h4V9H9z"></path>';

            const button = document.createElement("div");
            button.id = buttonId;
            button.className = normalButton.className;
            button.addEventListener("click", function() {
                const cozyClient = firefox(window).cozyClient;
                const now = new Date();
                cozyClient.create("io.cozy.bank.operations", {
                    amount: 0,
                    label: "New Operation",
                    rawDate: now.toISOString().substring(0, 10),
                    date: now.toISOString(),
                    currency: "EUR",
                    account: null,// todo
                    toCategorize: true,
                    isActive: true,
                }).then((t) => {
                    location.href = "#/operations/" + t._id;
                });
            });
            button.appendChild(svgIcon);
            buttonsSpan.appendChild(button);
        }
    } else {
        if (button) {
            button.parentNode.removeChild(button);
        }
    }
}

checkHash();