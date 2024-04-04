let LoginUsername = null;
let LoggedIn = false;
let LoginCode = null;
let SelectedItems = [];

var site_socket = io.connect('https://bloxyplus.com/site');
//var site_socket = io.connect('http://127.0.0.1:8000/site');

site_socket.on('users_added', function(data) {
    $("#online_animation").removeClass("inactive")
    $("#online_animation").removeClass("active")
    $("#online_animation").addClass("active")
    $("#online_users").text(data.users.toString());
});

site_socket.on('message_sent', function(data) {
    var sanitizedThumbnail = DOMPurify.sanitize(data.thumbnail);
    var sanitizedUsername = DOMPurify.sanitize(data.username);
    var sanitizedMessage = DOMPurify.sanitize(data.message);

    var message = `
        <div class="chatbar_message">
            <img class="user_profile" src="${sanitizedThumbnail}">
            <div>
                <p style="font-weight: bold; font-size: 20px;">${sanitizedUsername}</p>
                <p>${sanitizedMessage}</p>
            </div>
        </div>
    `;

    var $message = $(message);
    var $message = $(message);
    $("#chatbar_messages").prepend($message);
    $("#chatbar_messages").scrollTop($("#chatbar_messages")[0].scrollHeight);
});

function FormatNumber(num, precision = 1) {
    const map = [
      { suffix: 'T', threshold: 1e12 },
      { suffix: 'B', threshold: 1e9 },
      { suffix: 'M', threshold: 1e6 },
      { suffix: 'K', threshold: 1e3 },
      { suffix: '', threshold: 1 },
    ];
  
    const found = map.find((x) => Math.abs(num) >= x.threshold);
    if (found) {
      const formatted = (num / found.threshold).toFixed(precision) + found.suffix;
      return formatted;
    }
  
    return num;
}

function GetColor(imageUrl, callback) {
    var img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = function() {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var pixels = imageData.data;

        var colorMap = {};
        var tolerance = 40;

        for (var i = 0; i < pixels.length; i += 4) {
            var r = pixels[i];
            var g = pixels[i + 1];
            var b = pixels[i + 2];

            var isCloseToWhite = r > 255 - tolerance && g > 255 - tolerance && b > 255 - tolerance;
            var isCloseToBlack = r < tolerance && g < tolerance && b < tolerance;

            var color = 'rgb(' + r + ',' + g + ',' + b + ')';
            
            if (!isCloseToWhite && !isCloseToBlack) {
                if (colorMap[color]) {
                    colorMap[color]++;
                } else {
                    colorMap[color] = 1;
                }
            }
        }
        
        var maxCount = 0;
        var dominantColor = '';
        for (var key in colorMap) {
            if (colorMap[key] > maxCount) {
                maxCount = colorMap[key];
                dominantColor = key;
            }
        }
        callback(dominantColor);
    };
    img.src = imageUrl;
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

function Copy(Text) {
    navigator.clipboard.writeText(Text);
}

function Refresh() {
    location.reload();
}

function ShowPopup(ID) {
    $('[class$="popup"]').hide();
    $("#modal_background").show();
    
    $("#" + ID).animate({
        top: '50%',
        opacity: 'show'
    }, 500);
}

function HidePopup(ID) {
    $("#modal_background").hide();
    $("#" + ID).css({
        top: '55%'
    }).hide();
}

function WalletClick(ID) {
    SelectedItems = [];
    $('#wallet_modal [id$="_click"]').hide();
    $("#" + ID).show();
    ShowPopup("wallet_modal");
    GetInventory();
}

function GetChatMessages() {
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
                    <div class="chatbar_message">
                        <img class="user_profile" src="${data.thumbnail}">
                        <div>
                            <p style="font-weight: bold; font-size: 20px;">${data.username}</p>
                            <p>${data.message}</p>
                        </div>
                    </div>
                `;

                var $message = $(message);
                $("#chatbar_messages").prepend($message);
                $("#chatbar_messages").scrollTop($("#chatbar_messages")[0].scrollHeight);
            });
        });
}

function GetInventory() {
    if (LoggedIn !== true) {
        Notification("You are not logged in!", "Error", 3000);
        HidePopup("wallet_modal");
        return;
    }

    $("#wallet_holder").children().not("#wallet_load").remove();
    $("#wallet_load").show();

    superagent.get("/api/user/inventory")
        .end((Error, Result) => {
            if (Error) {
                console.log(Error);
                return;
            }

            if (Result.body.error) {
                Notification(Result.body.message, "Error", 3000);
                return;
            }

            $.each(Result.body.data.inventory, function(index, pet) {
                const $pet = $('<div>').addClass('wallet_item');
                const $img = $('<img>').attr('src', pet.thumbnail);
                const $name = $('<p>').text(pet.name);
                const $value = $('<h3>').text('$' + FormatNumber(pet.value));

                var $color = NaN;

                GetColor("http://127.0.0.1:8000/image?url=" + pet.thumbnail, function(dominantColor) {
                    $color = dominantColor
                });

                $pet.append($img);
                $pet.append($name);
                $pet.append($value);

                $pet.click(function() {
                    if ($pet.hasClass('active')) {
                        const selectedIndex = SelectedItems.indexOf(pet);
                        SelectedItems.splice(selectedIndex, 1);
                        $pet.css({
                            'border': '2px solid var(--color-border)',
                            'border-bottom': '10px solid var(--color-border)'
                        });
                        $pet.removeClass('active');
                    } else {
                        SelectedItems.push(pet);
                        $pet.css({
                            'border': '2px solid ' + '#3577FC',
                            'border-bottom': '10px solid ' + '#3577FC'
                        });
                        $pet.addClass('active');
                    }
                });

                $("#wallet_holder").append($pet);
            });

            $('#walletbalance').html(FormatNumber(Result.body.data.balance));
            $("#wallet_load").hide();
        });
}

function LoginModal1Click() {
    var username = $("#login_modal_1_username").val();

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
            $("#login_modal_2_phrase").val(LoginCode);
            HidePopup("login_modal_1");
            ShowPopup("login_modal_2");
        });
}

function LoginModal2Click() {
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
            HidePopup("login_modal_2");
            Refresh();
            Notification("Successfully Logged in", "Success", 3000);
        });
}

function SendChatMessageClick() {
    if (LoggedIn !== true) {
        Notification("You are not logged in!", "Error", 3000);
    }

    var message = $("#chatbar_input").val();

    if (message === "") {
        return Notification("Please enter a chat message", "Error", 3000);
    }

    $("#chatbar_input").val("");

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

function WithdrawPets() {
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
        });
}

function GetUserData() {
    superagent.get("/api/user/get")
        .end((Error, Result) => {
            if (Error) {
                console.log(Error);
            }

            if (Result.body.error) {
                Notification(Result.body.message, "Error", 3000);
                return;
            }

            if (Result.body.message === "User not logged in") {
                $("#wallet").hide();
                $("#user_profile").hide();
                $("#logout_button").hide();
                $("#login_button").show();
            } else {
                $("#wallet").show();
                $("#user_profile").show();
                $("#logout_button").show();
                $("#login_button").hide();

                if (!Result.body.data.whitelisted) {
                    window.location.replace("https://discord.gg/bloxyplus");
                }

                $('#username').html(Result.body.data.username);
                $('#walletbalance').html(FormatNumber(Result.body.data.balance_int));
                $('#userimage').attr('src', Result.body.data.thumbnail);
                LoggedIn = true;
            }
        });
}

function GetAffiliateCode() {
    if (LoggedIn !== true) {
        Notification("You are not logged in!", "Error", 3000);
        HidePopup("affiliates_modal");
    }

    superagent.get("/api/affiliates/get")
        .end((Error, Result) => {
            if (Error) {
                console.log(Error);
            }

            if (Result.body.error) {
                Notification(Result.body.message, "Error", 3000);
                return;
            }

            $("#affiliates_modal_link").val(Result.body.code)
    });
}

function GetLeaderboard() {
    $("#leaderboard_load").show()
    $("#leaderboard_holder").hide()
    $("#leaderboard_holder").children().not("#leaderboard_stats").remove();

    superagent.get("/api/leaderboard/get")
        .end((Error, Result) => {
            if (Error) {
                console.log(Error);
            }

            if (Result.body.error) {
                Notification(Result.body.message, "Error", 3000);
                return;
            }

            $.each(Result.body.leaderboard, function(index, data) {
                $user = `
                    <div class="leaderboard_item">
                        <img class="user_profile" src="${data.thumbnail}">
                        <p style="margin-left: 5px;">${data.name}</p>
                        <div class="leaderboard_profit">
                            <svg style="margin-top: 16px;" xmlns="http://www.w3.org/2000/svg" width="32" height="20" fill="var(--color-primary)" class="bi bi-house-door-fill" viewBox="0 00 16 16">
                                <path fill-rule="evenodd" d="M6.95.435c.58-.58 1.52-.58 2.1 0l6.515 6.516c.58.58.58 1.519 0 2.098L9.05 15.565c-.58.58-1.519.58-2.098 0L.435 9.05a1.48 1.48 0 0 1 0-2.098z"/>
                            </svg>
                            <p style="color: var(--color-primary)">${FormatNumber(data.profit)}</p>
                        </div>
                    </div>
                `

                $("#leaderboard_holder").append($user)
            })

            $("#leaderboard_load").hide()
            $("#leaderboard_holder").show()
        });
}

$(document).ready(function () {
    // Load Data

    GetChatMessages();
    GetUserData();

    // Bottom Bar

    $("#bottombar_menu").on("click", function() {
        var mainMenu = $("#mainmenu");
        if (mainMenu.css("display") === "none") {
            mainMenu.css("display", "flex");
        } else {
            mainMenu.css("display", "none");
        }
    });

    $("#bottombar_chat").on("click", function() {
        $("#chatbar").toggle();
    })

    $("#mobile_affiliates_button").on("click", function() {
        $("#mainmenu").hide();
        ShowPopup("affiliates_modal");
        GetAffiliateCode();
    })

    $("#mobile_leaderboard_button").on("click", function() {
        $("#mainmenu").hide();
        ShowPopup("leaderboard_modal");
        GetLeaderboard();
    })

    // Site Functions

    $("#deposit_button").on("click", function() {
        ShowPopup("deposit_modal");
    })

    $("#affiliates_button").on("click", function() {
        ShowPopup("affiliates_modal");
        GetAffiliateCode();
    })
    
    $("#affiliates_click_homepage").on("click", function() {
        ShowPopup("affiliates_modal");
        GetAffiliateCode();
    })

    $("#leaderboard_button").on("click", function() {
        ShowPopup("leaderboard_modal");
        GetLeaderboard();
    })

    $("#login_button").on("click", function() {
        ShowPopup("login_modal_1");
    })

    $("#login_button").on("click", function() {
        ShowPopup("login_modal_1");
    })

    $("#wallet_button").on("click", function() {
        WalletClick("withdraw_click")
    })

    $("#chatbar_send").on("click", function() {
        SendChatMessageClick();
    })

    // Modals

    // Affiliates Modal

    $("#affiliates_modal_close").on("click", function() {
        HidePopup("affiliates_modal");
    })

    $("#affiliates_modal_copy").on("click", function() {
        Copy($("#affiliates_modal_link").val());
        Notification("Successfully copied link!", "Success", 3000);
    })

    // Deposit Modal

    $("#deposit_modal_close").on("click", function() {
        HidePopup("deposit_modal");
    })

    // Leaderboard Modal

    $("#leaderboard_modal_close").on("click", function() {
        HidePopup("leaderboard_modal");
    })

    // Login Modal 1

    $("#login_modal_1_close").on("click", function() {
        HidePopup("login_modal_1");
    })

    $("#login_modal_1_click").on("click", function() {
        LoginModal1Click();
    })

    // Login Modal 2

    $("#login_modal_2_close").on("click", function() {
        HidePopup("login_modal_2")
    })

    $("#login_modal_2_click").on("click", function() {
        LoginModal2Click();
    })

    // Wallet Modal

    $("#wallet_modal_close").on("click", function() {
        HidePopup("wallet_modal");
    })

    $("#withdraw_click").on("click", function() {
        WithdrawPets();
    })

    // Finish Loading

    $("#loading_screen").hide();
});