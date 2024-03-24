let LoginUsername = null;
let LoginCode = null;
let GameChoice = "heads";
let CurrentGameID = null;
const SelectedItems = [];

var games_socket = io.connect('https://bloxyplus.com/games');
var site_socket = io.connect('https://bloxyplus.com/site');

site_socket.on('users_added', function(data) {
    $("#online_users").text(data.users.toString());
});

site_socket.on('message_sent', function(data) {
    var sanitizedThumbnail = DOMPurify.sanitize(data.thumbnail);
    var sanitizedUsername = DOMPurify.sanitize(data.username);
    var sanitizedMessage = DOMPurify.sanitize(data.message);

    var message = `
        <div class="chatmessage">
            <div style="width: 100%;  overflow: auto; display: flex; flex-direction: column;">
                <div style="margin-bottom: 0; display: flex; align-items: center;">
                    <img class="hoverimg transparent" style="margin-top: 12px; margin-right: 10px; width: 45px; height: 45px;" src="${sanitizedThumbnail}">
                    <h3 class="texthover" style="font-size: 18px; margin-top: 30px; text-align: right;">${sanitizedUsername}</h3>
                </div>
                <h3 style="font-size: 16px; font-weight: 500; margin-top: -5px;">${sanitizedMessage}</h3>
            </div>                
        </div>
    `;

    var $message = $(message);
    $("#chatmessages").prepend($message);
});

games_socket.on('game_ended', function(data) {
    $("#" + data.gid + "_headsimg").attr('src', data.heads.thumbnail);
    $("#" + data.gid + "_headsname").text(data.heads.username)
    $("#" + data.gid + "_tailsimg").attr('src', data.tails.thumbnail);
    $("#" + data.gid + "_tailsname").text(data.tails.username)
    setTimeout(() => {
        $("#" + data.gid + "_coin").addClass("animate-" + data.winner);
    }, 3000);
    setTimeout(() => {
        $("#" + data.gid + "_" + data.winner + "img").addClass("active");
    }, 5500);

    $("#" + data.gid).remove();
    let wonValue = 0;
    var gameItem = $('<div id="' + data.gid + '" class="gameitem"></div>');
    var imagesDiv = $('<div id="images" style="overflow: hidden; display: flex; margin-right: auto; white-space: nowrap;"></div>');
    var activeSide = data.heads.username !== null ? data.heads : data.tails;
    var usersDiv = $('<div id="users"></div>');

    data.heads.pets.forEach(function (pet) {
        wonValue = wonValue + pet.value
    })

    data.tails.pets.forEach(function (pet) {
        wonValue = wonValue + pet.value
    })

    var heads = $('<img class="hoverimg" style="width: 45px; height: 45px;" src="' + (data.heads.thumbnail === null ? '../static/img/heads.png' : data.heads.thumbnail) + '">');
    var tails = $('<img class="hoverimg" style="margin-left: 5px; width: 45px; height: 45px;" src="' + (data.tails.thumbnail === null ? '../static/img/tails.png' : data.tails.thumbnail) + '">');  
                
    usersDiv.append(heads);
    usersDiv.append(tails);

    if (data.winner === "heads") {
        heads.addClass("hoverimg active");
    } else if (data.winner === "tails") {
        tails.addClass("hoverimg active");
    }

    imagesDiv.append(usersDiv);
    var itemsDiv = $('<div id="items" style="margin-left: 75px;"></div>');

    if (data.winner != null) {
        for (var i = 0; i < Math.min(data.heads.pets.length, 2); i++) {
            itemsDiv.append('<img class="hoverimg" style="margin-left: -20px; width: 45px; height: 45px;" src="https://' + document.domain + "/image?url=" + activeSide.pets[i].image + '">');
        }

        for (var i = 0; i < Math.min(data.tails.pets.length, 2); i++) {
            itemsDiv.append('<img class="hoverimg" style="margin-left: -20px; width: 45px; height: 45px;" src="https://' + document.domain + "/image?url=" + activeSide.pets[i].image + '">');
        }
    } else {
        for (var i = 0; i < Math.min(activeSide.pets.length, 4); i++) {
            itemsDiv.append('<img class="hoverimg" style="margin-left: -20px; width: 45px; height: 45px;" src="https://' + document.domain + "/image?url=" + activeSide.pets[i].image + '">');
        }
    }

    if (data.winner == null) {
        var remainingItems = activeSide.pets.length - 4;
    } else {
        var remainingItems = (data.heads.pets.length + data.tails.pets.length) - 4;
    }

    imagesDiv.append(itemsDiv);

    if (remainingItems > 0) {
        imagesDiv.append('<h2 id="remainingitems" style="margin: 0; margin-top: 7px; margin-left: 5px;">+' + remainingItems + '</h2>');
    }

    gameItem.append(imagesDiv);

    var joinDiv = $('<div id="join" style="display: flex; position: relative; right: 22px;"></div>');
    var valueDiv = $('<div></div>');

    if (data.winner == null) {
        valueDiv.append('<h2 style="text-align: center; color: var(--color-primary); margin: 0; margin-right: 25px;">$' + (FormatNumber(data.value)) + '</h2>');
        valueDiv.append('<h4 style="text-align: center; margin: 0; margin-right: 25px;">$' + (FormatNumber(data.value * 0.9)) + ' - $' + (FormatNumber(data.value * 1.1)) + '</h4>');
    } else {
        valueDiv.append('<h2 style="text-align: center; color: var(--color-primary); margin: 0; margin-right: 25px;">$' + (FormatNumber(wonValue)) + '</h2>');
        valueDiv.append('<h4 style="text-align: center; margin: 0; margin-right: 25px;">$' + (FormatNumber(wonValue * 0.9)) + ' - $' + (FormatNumber(wonValue * 1.1)) + '</h4>');
    }

    if (data.active == true) {
        var joinButton = $('<button style="width: 100px;" class="button">Join</button>');
        joinButton.click(function () {
            CurrentGameID = data.gid;
            InventoryClick('#inventoryjoinbutton');
        });
    } else {
        var joinButton = $('<button style="width: 100px;" class="button secondary2">Join</button>');
        joinButton.click(function () {
            Notification("The game has already ended!", "Error", 3000);
        });
    }

    joinDiv.append(valueDiv);
    joinDiv.append(joinButton);

    gameItem.append(joinDiv);

    $('#gameholder').append(gameItem);

    joinDiv.append(`<button onclick="ShowPopup('${('#' + data.gid + '_popup')}')" style="margin-left: 10px; width: 100px;" class="button">View</button>`);
})

games_socket.on('game_created', function(data) {
    var gameItem = $('<div id="' + data.gid + '" class="gameitem"></div>');
    var imagesDiv = $('<div id="images" style="overflow: hidden; display: flex; margin-right: auto; white-space: nowrap;"></div>');
    var activeSide = data.heads.username !== null ? data.heads : data.tails;

    var usersDiv = $('<div id="users"></div>');
    usersDiv.append('<img class="hoverimg" style="width: 45px; height: 45px;" src="' + (data.heads.thumbnail === null ? '../static/img/heads.png' : data.heads.thumbnail) + '">');
    usersDiv.append('<img class="hoverimg" style="margin-left: 5px; width: 45px; height: 45px;" src="' + (data.tails.thumbnail === null ? '../static/img/tails.png' : data.tails.thumbnail) + '">');
    imagesDiv.append(usersDiv);

    var itemsDiv = $('<div id="items" style="margin-left: 75px;"></div>');

    for (var i = 0; i < Math.min(activeSide.pets.length, 4); i++) {
        itemsDiv.append('<img class="hoverimg" style="margin-left: -20px; width: 45px; height: 45px;" src="https://' + document.domain + "/image?url=" + activeSide.pets[i].image + '">');
    }

    var remainingItems = activeSide.pets.length - 4;

    imagesDiv.append(itemsDiv);

    if (remainingItems > 0) {
        imagesDiv.append('<h2 id="remainingitems" style="margin: 0; margin-top: 7px; margin-left: 5px;">+' + remainingItems + '</h2>');
    }

    gameItem.append(imagesDiv);

    var joinDiv = $('<div id="join" style="display: flex; position: relative; right: 22px;"></div>');
    var valueDiv = $('<div></div>');

    valueDiv.append('<h2 style="text-align: center; color: var(--color-primary); margin: 0; margin-right: 25px;">$' + (FormatNumber(data.value)) + '</h2>');
    valueDiv.append('<h4 style="text-align: center; margin: 0; margin-right: 25px;">$' + (FormatNumber(data.value * 0.9)) + ' - $' + (FormatNumber(data.value * 1.1)) + '</h4>');

    var joinButton = $('<button style="width: 100px;" class="button">Join</button>');
    joinButton.click(function () {
        CurrentGameID = data.gid;
        InventoryClick('#inventoryjoinbutton');
    });

    joinDiv.append(valueDiv);
    joinDiv.append(joinButton);

    gameItem.append(joinDiv);

    $('#gameholder').append(gameItem);

    const headsimg = (data.heads.thumbnail === null ? '../static/img/heads.png' : data.heads.thumbnail);
    const tailsimg = (data.tails.thumbnail === null ? '../static/img/tails.png' : data.tails.thumbnail);
    const headsname = (data.heads.username === null ? 'Waiting..' : data.heads.username);
    const tailsname = (data.tails.username === null ? 'Waiting..' : data.tails.username);
    const headsclass = (data.winner == null ? "hoverimg" : "hoverimg active")
    const tailsclass = (data.winner == null ? "hoverimg" : "hoverimg active")

    var popup = `
        <div id="${(data.gid + "_popup")}" class="popup">
            <div onclick="HidePopup('${("#" + data.gid + "_popup")}');" class="popupclose">
                <svg style="cursor: pointer;" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="var(--color-text1st)" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M18 6 6 18"></path>
                    <path d="m6 6 12 12"></path>
                </svg>
            </div>
            <div style="left: 50%; transform: translateX(-50%); width: 80%; display: flex; align-items: center; height: 100%; position: relative; text-align: center;">
                <div style="position: absolute; left: 25px; margin-bottom: 25px;">
                    <img id='${(data.gid + "_headsimg")}' class="${headsclass}" style="width: 100px; height: 100px;" src="${headsimg}">
                    <h4 id='${(data.gid + "_headsname")}' style="margin: 0; margin-top: 5px;">${headsname}</h4>
                    <img style="position: absolute; bottom: 0; left: 0; width: 25px; height: 25px;" src="../static/img/heads.png">
                </div>
                <div style="position: absolute; right: 25px; margin-bottom: 25px;">
                    <img id='${(data.gid + "_tailsimg")}' class=${tailsclass} style="width: 100px; height: 100px;" src="${tailsimg}">
                    <h4 id='${(data.gid + "_tailsname")}' style="margin: 0; margin-top: 5px;">${tailsname}</h4>
                    <img style="position: absolute; bottom: 0; left: 0; width: 25px; height: 25px;" src="../static/img/tails.png">
                </div>
                <div style="position: absolute; left: 50%; transform: translateX(-50%);">
                    <div id="${(data.gid + "_coin")}" class='coin'>
                        <div id="heads" class="heads"></div>
                        <div id="tails" class="tails"></div>
                    </div>
                </div>
            </div>
        </div>
    `

    $('body').append(popup);

    joinDiv.append(`<button onclick="ShowPopup('${('#' + data.gid + '_popup')}')" style="margin-left: 10px; width: 100px;" class="button">View</button>`);
});

function Copy(Text) {
    navigator.clipboard.writeText(Text);
}

function Refresh() {
    location.reload();
}

function ShowPopup(ID) {
    $(ID).animate({
        top: '50%',
        opacity: 'show'
    }, 500);
}

function HidePopup(ID) {
    $(ID).css({
        top: '55%'
    }).hide();
}

function InventoryClick(btn) {
    $("#inventoryloading").show();
    $("#inventorywithdrawbutton").hide();
    $("#inventorycreatebutton").hide();
    $("#inventoryjoinbutton").hide();
    $(btn).show();

    GetInventory();
}

function HomeButtonClick() {
    $('#chatbar').hide(); 
    $('#homebottom').toggleClass('active'); 
    $('#chatbottom').removeClass('active'); 
    $('#gamesbottom').removeClass('active');
}

function GamesButtonClick() {
    $('#chatbar').hide(); 
    $('#gamesbottom').toggleClass('active'); 
    $('#chatbottom').removeClass('active'); 
    $('#homebottom').removeClass('active');
}

function ChatButtonClick() {
    $('#chatbar').toggle(); 
    $('#chatbottom').toggleClass('active'); 
    $('#gamesbottom').removeClass('active'); 
    $('#homebottom').removeClass('active');
}

function FormatNumber(value) {
    const suffixes = ["", "K", "M", "B", "T"];
    let suffixIndex = 0;

    while (value >= 1000 && suffixIndex < suffixes.length - 1) {
        value /= 1000;
        suffixIndex++;
    }

    return value.toFixed(1) + suffixes[suffixIndex];
}

function Notification(text = "Success", type = "Success", duration = 3000) {
    if (type === "Success") {
        Toastify({
            text: `✅ ${text}`,
            duration: duration,
            newWindow: true,
            close: false,
            gravity: "top",
            position: "center",
            stopOnFocus: true,
            style: {
                background: "var(--color-2nd)",
                borderRadius: '5px',
                boxShadow: 'none',
                border: '1px solid var(--color-border)'
            },
            onClick: function () {
            }
        }).showToast();
    } else if (type === "Warning") {
        Toastify({
            text: `⚠️ ${text}`,
            duration: duration,
            newWindow: true,
            close: false,
            gravity: "top",
            position: "center",
            stopOnFocus: true,
            style: {
                background: "var(--color-2nd)",
                borderRadius: '5px',
                boxShadow: 'none',
                border: '1px solid var(--color-border)'
            },
            onClick: function () {
            }
        }).showToast();
    } else if (type === "Error") {
        Toastify({
            text: `❌ ${text}`,
            duration: duration,
            newWindow: true,
            close: false,
            gravity: "top",
            position: "center",
            stopOnFocus: true,
            style: {
                background: "var(--color-2nd)",
                borderRadius: '5px',
                boxShadow: 'none',
                border: '1px solid var(--color-border)'
            },
            onClick: function () {
            }
        }).showToast();
    }
}

function SelectCoin(choice = "heads") {
    if (choice === "heads") {
        $('#headsselect, #tailsselect').removeClass('dark');
        $("#tailsselect").addClass('dark');
        GameChoice = "heads"
    } else {
        $('#headsselect, #tailsselect').removeClass('dark');
        $("#headsselect").addClass('dark');
        GameChoice = "tails"
    }
}

function DepositClick() {
    ShowPopup("#depositpopup");
}

function WithdrawClick() {
    superagent.post("/api/user/withdraw")
        .send({
            "items": SelectedItems
        })
        .end((Error, Result) => {
            if (Error) {
                console.log(Error);
            }

            if (Result.body.error === true) {
                Notification(Result.body.message, "Error", 3000);
                return;
            }

            Notification(Result.body.message, "Success", 3000);
            HidePopup("#inventorypopup");
            GetInventory();
        });
    }

function GetGames() {
    superagent.get("/api/coinflip/get")
        .end((Error, Result) => {
            if (Error) {
                console.log(Error);
            }

            if (Result.body.error) {
                Notification(Result.body.message, "Error", 3000);
                return;
            }

            Result.body.games.forEach(function (data) {
                let wonValue = 0;
                var gameItem = $('<div id="' + data.gid + '" class="gameitem"></div>');
                var imagesDiv = $('<div id="images" style="overflow: hidden; display: flex; margin-right: auto; white-space: nowrap;"></div>');
                var activeSide = data.heads.username !== null ? data.heads : data.tails;
                var usersDiv = $('<div id="users"></div>');

                data.heads.pets.forEach(function (pet) {
                    wonValue = wonValue + pet.value
                })

                data.tails.pets.forEach(function (pet) {
                    wonValue = wonValue + pet.value
                })

                var heads = $('<img class="hoverimg" style="width: 45px; height: 45px;" src="' + (data.heads.thumbnail === null ? '../static/img/heads.png' : data.heads.thumbnail) + '">');
                var tails = $('<img class="hoverimg" style="margin-left: 5px; width: 45px; height: 45px;" src="' + (data.tails.thumbnail === null ? '../static/img/tails.png' : data.tails.thumbnail) + '">');
                
                
                usersDiv.append(heads);
                usersDiv.append(tails);

                if (data.winner === "heads") {
                    heads.addClass("hoverimg active");
                } else if (data.winner === "tails") {
                    tails.addClass("hoverimg active");
                }

                imagesDiv.append(usersDiv);
                var itemsDiv = $('<div id="items" style="margin-left: 75px;"></div>');

                if (data.winner != null) {
                    for (var i = 0; i < Math.min(data.heads.pets.length, 2); i++) {
                        itemsDiv.append('<img class="hoverimg" style="margin-left: -20px; width: 45px; height: 45px;" src="https://' + document.domain + "/image?url=" + activeSide.pets[i].image + '">');
                    }

                    for (var i = 0; i < Math.min(data.tails.pets.length, 2); i++) {
                        itemsDiv.append('<img class="hoverimg" style="margin-left: -20px; width: 45px; height: 45px;" src="https://' + document.domain + "/image?url=" + activeSide.pets[i].image + '">');
                    }
                } else {
                    for (var i = 0; i < Math.min(activeSide.pets.length, 4); i++) {
                        itemsDiv.append('<img class="hoverimg" style="margin-left: -20px; width: 45px; height: 45px;" src="https://' + document.domain + "/image?url=" + activeSide.pets[i].image + '">');
                    }
                }

                if (data.winner == null) {
                    var remainingItems = activeSide.pets.length - 4;
                } else {
                    var remainingItems = (data.heads.pets.length + data.tails.pets.length) - 4;
                }

                imagesDiv.append(itemsDiv);

                if (remainingItems > 0) {
                    imagesDiv.append('<h2 id="remainingitems" style="margin: 0; margin-top: 7px; margin-left: 5px;">+' + remainingItems + '</h2>');
                }

                gameItem.append(imagesDiv);

                var joinDiv = $('<div id="join" style="display: flex; position: relative; right: 22px;"></div>');
                var valueDiv = $('<div></div>');

                if (data.winner == null) {
                    valueDiv.append('<h2 style="text-align: center; color: var(--color-primary); margin: 0; margin-right: 25px;">$' + (FormatNumber(data.value)) + '</h2>');
                    valueDiv.append('<h4 style="text-align: center; margin: 0; margin-right: 25px;">$' + (FormatNumber(data.value * 0.9)) + ' - $' + (FormatNumber(data.value * 1.1)) + '</h4>');
                } else {
                    valueDiv.append('<h2 style="text-align: center; color: var(--color-primary); margin: 0; margin-right: 25px;">$' + (FormatNumber(wonValue)) + '</h2>');
                    valueDiv.append('<h4 style="text-align: center; margin: 0; margin-right: 25px;">$' + (FormatNumber(wonValue * 0.9)) + ' - $' + (FormatNumber(wonValue * 1.1)) + '</h4>');
                }

                if (data.active == true) {
                    var joinButton = $('<button style="width: 100px;" class="button">Join</button>');
                    joinButton.click(function () {
                        CurrentGameID = data.gid;
                        InventoryClick('#inventoryjoinbutton');
                    });
                } else {
                    var joinButton = $('<button style="width: 100px;" class="button secondary2">Join</button>');
                    joinButton.click(function () {
                        Notification("The game has already ended!", "Error", 3000);
                    });
                }

                joinDiv.append(valueDiv);
                joinDiv.append(joinButton);

                gameItem.append(joinDiv);

                $('#gameholder').append(gameItem);

                const headsimg = (data.heads.thumbnail === null ? '../static/img/heads.png' : data.heads.thumbnail);
                const tailsimg = (data.tails.thumbnail === null ? '../static/img/tails.png' : data.tails.thumbnail);
                const headsname = (data.heads.username === null ? 'Waiting..' : data.heads.username);
                const tailsname = (data.tails.username === null ? 'Waiting..' : data.tails.username);
                const headsclass = (data.winner === "heads" ? "hoverimg active" : "hoverimg");
                const tailsclass = (data.winner === "tails" ? "hoverimg active" : "hoverimg");
                const coinclass = (data.winner == null ? "coin" : "coin animate-" + data.winner)

                var popup = `
                    <div id="${(data.gid + "_popup")}" class="popup">
                        <div onclick="HidePopup('${("#" + data.gid + "_popup")}');" class="popupclose">
                            <svg style="cursor: pointer;" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="var(--color-text1st)" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <path d="M18 6 6 18"></path>
                                <path d="m6 6 12 12"></path>
                            </svg>
                        </div>
                        <div style="left: 50%; transform: translateX(-50%); width: 80%; display: flex; align-items: center; height: 100%; position: relative; text-align: center;">
                            <div style="position: absolute; left: 25px; margin-bottom: 25px;">
                                <img id="${(data.gid + "_headsimg")}" class="${headsclass}" style="width: 100px; height: 100px;" src="${headsimg}">
                                <h4 id="${(data.gid + "_headsname")}" style="margin: 0; margin-top: 5px;">${headsname}</h4>
                                <img style="position: absolute; bottom: 0; left: 0; width: 25px; height: 25px;" src="../static/img/heads.png">
                            </div>
                            <div style="position: absolute; right: 25px; margin-bottom: 25px;">
                                <img id="${(data.gid + "_tailsimg")}" class="${tailsclass}" style="width: 100px; height: 100px;" src="${tailsimg}">
                                <h4 id="${(data.gid + "_tailsname")}" style="margin: 0; margin-top: 5px;">${tailsname}</h4>
                                <img style="position: absolute; bottom: 0; left: 0; width: 25px; height: 25px;" src="../static/img/tails.png">
                            </div>
                            <div style="position: absolute; left: 50%; transform: translateX(-50%);">
                                <div id="${(data.gid + "_coin")}" class="${coinclass}">
                                    <div id="heads" class="heads"></div>
                                    <div id="tails" class="tails"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `

                $('body').append(popup);

                joinDiv.append(`<button onclick="ShowPopup('${('#' + data.gid + '_popup')}')" style="margin-left: 10px; width: 100px;" class="button">View</button>`);
            });

            $("#gamesloading").hide();
        });
}

function GetInventory() {
    const inventoryHolder = $('#inventoryholder');
    const inventoryData = $('#inventorydata');
    const walletBalance = $('#walletbalance');
    inventoryHolder.html('');
    inventoryData.text("Balance: 0 | Items: 0");
    SelectedItems.length = 0;
    ShowPopup("#inventorypopup");

    superagent.get("/api/user/inventory")
        .end((Error, Result) => {
            if (Error) {
                console.log(Error);
                HidePopup("#inventorypopup");
            }

            if (Result.body.error) {
                Notification(Result.body.message, "Error", 3000);
                HidePopup("#inventorypopup");
                return;
            }
            
            $("#inventoryloading").hide()
            const Items = Result.body.data.inventory;

            const inventoryHolder = $('#inventoryholder');
            inventoryHolder.html('');

            $.each(Items, function (index, item) {
                const itemDiv = $('<div>').addClass('inventoryslot');

                const img = $('<img>').attr('src', 'https://' + document.domain + "/image?url=" + item.image);

                const name = $('<h4>').css({
                    margin: '0',
                    padding: '0',
                    lineHeight: 'normal',
                    fontFamily: 'Poppins, sans-serif'
                }).text(item.name);

                const value = $('<h2>').css({
                    color: 'var(--color-primary)',
                    margin: '0',
                    padding: '0',
                    lineHeight: 'normal',
                    fontFamily: 'Poppins, sans-serif'
                }).text(`$${FormatNumber(item.value.toFixed(2))}`);

                itemDiv.click(function () {
                    if (itemDiv.hasClass('active')) {
                        const selectedIndex = SelectedItems.indexOf(item);
                        SelectedItems.splice(selectedIndex, 1);
                        itemDiv.removeClass('active');
                    } else {
                        SelectedItems.push(item);
                        itemDiv.addClass('active');
                    }
                });

                itemDiv.append(img);
                itemDiv.append(name);
                itemDiv.append(value);

                inventoryHolder.append(itemDiv);
            });

            const Worth = Result.body.data.balance;
            const Total = Result.body.data.items;
            
            walletBalance.text(`${FormatNumber(Worth.toFixed(2))}`)
            inventoryData.text(`Balance: $${FormatNumber(Worth.toFixed(2))} | Items: ${Total}`);
        });
}

function SendMessage() {
    var message = $("#chatmessage").val();

    if (message === "") {
        return Notification("Please enter a chat message", "Error", 3000);
    }

    superagent.post("/api/chat/send")
        .send({
            "message": DOMPurify.sanitize(message)
        })
        .end((Error, Result) => {
            if (Error) {
                console.log(Error);
            }

            if (Result.body.error === true) {
                Notification(Result.body.message, "Error", 3000);
                return;
            }
        });
    }

function GetMessages() {
    superagent.get("/api/chat/get")
        .end((Error, Result) => {
            if (Error) {
                console.log(Error);
            }
    
            if (Result.body.error) {
                Notification(Result.body.message, "Error", 3000);
                return;
            }
    
            Result.body.messages.forEach(function (data) {
                var message = `
                    <div class="chatmessage">
                        <div style="width: 100%;  overflow: auto; display: flex; flex-direction: column;">
                            <div style="margin-bottom: 0; display: flex; align-items: center;">
                                <img class="hoverimg transparent" style="margin-top: 12px; margin-right: 10px; width: 45px; height: 45px;" src="${data.thumbnail}">
                                <h3 class="texthover" style="font-size: 18px; margin-top: 30px; text-align: right;">${data.username}</h3>
                            </div>
                            <h3 style="font-size: 16px; font-weight: 500; margin-top: -5px;">${data.message}</h3>
                        </div>                
                    </div>
                `

                var $message = $(message);
                $("#chatmessages").prepend($message);
            });
        });
}

function CreateGame() {
    superagent.post("/api/coinflip/create")
        .send({
            "items": SelectedItems,
            "choice": GameChoice
        })
        .end((Error, Result) => {
            if (Error) {
                console.log(Error);
            }

            if (Result.body.error === true) {
                Notification(Result.body.message, "Error", 3000);
                return;
            }

            Notification(Result.body.message, "Success", 3000);
            HidePopup("#inventorypopup");
        });
    }

function JoinGame() {
    superagent.post("/api/coinflip/join")
        .send({
            "items": SelectedItems,
            "gid": CurrentGameID
        })
        .end((Error, Result) => {
            if (Error) {
                console.log(Error);
            }

            if (Result.body.error === true) {
                Notification(Result.body.message, "Error", 3000);
                return;
            }

            Notification(Result.body.message, "Success", 3000);
            HidePopup("#inventorypopup");
            ShowPopup("#" + CurrentGameID + "_popup");
        });
    }  

function LoginButton1Click() {
    var username = $("#loginusername").val();

    if (username === "") {
        return Notification("Please enter your username first", "Error", 3000);
    }

    superagent.post("/api/login/get")
        .send({
            "username": username
        })
        .end((Error, Result) => {
            if (Error) {
                console.log(Error);
            }

            if (Result.body.error) {
                Notification(Result.body.message, "Error", 3000);
                return;
            }

            LoginUsername = username
            LoginCode = Result.body.phrase
            $("#loginphrase").val(LoginCode);
            HidePopup("#loginpopup");
            ShowPopup("#loginpopup2");
        });
}

function LoginButton2Click() {
    superagent.post("/api/login/check")
        .send({
            "username": LoginUsername
        })
        .end((Error, Result) => {
            if (Error) {
                Notification("Error Making HTTP Request", "Error", 3000);
                console.log(Error);
            }

            if (Result.body.error) {
                Notification(Result.body.message, "Error", 3000);
                return;
            }

            LoginUsername = ""
            LoginCode = ""
            $("#loginphrase").val(LoginCode);
            HidePopup("#loginpopup2");
            Refresh();
            Notification("Successfully Logged in", "Success", 3000);
        });
}

$(document).ready(function () {
    GetGames();
    GetMessages();
});
