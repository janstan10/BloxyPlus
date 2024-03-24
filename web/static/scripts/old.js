let LoginUsername = ""
let LoginCode = ""
var ChatCooldown = false

function Notification(text="Success", type="Success", duration=3000) {
    if (type==="Success") {
        Toastify({
            text: `✅ ${text}`,
            duration: duration,
            newWindow: true,
            close: true,
            gravity: "top",
            position: "center",
            stopOnFocus: true,
            style: {
                background: "#171920",
                borderRadius: '10px',
                boxShadow: 'none',
                border: '2px solid var(--color-border)'
            },
            onClick: function(){}
        }).showToast();
    } else if (type==="Warning") {
        Toastify({
            text: `⚠️ ${text}`,
            duration: duration,
            newWindow: true,
            close: true,
            gravity: "top",
            position: "center",
            stopOnFocus: true,
            style: {
                background: "#171920",
                borderRadius: '10px',
                boxShadow: 'none',
                border: '2px solid var(--color-border)'
            },
            onClick: function(){}
        }).showToast();
    } else if (type==="Error") {
        Toastify({
            text: `❌ ${text}`,
            duration: duration,
            newWindow: true,
            close: true,
            gravity: "top",
            position: "center",
            stopOnFocus: true,
            style: {
                background: "#171920",
                borderRadius: '10px',
                boxShadow: 'none',
                border: '2px solid var(--color-border)'
            },
            onClick: function(){}
        }).showToast();
    }
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

function Copy(Text) {
    navigator.clipboard.writeText(Text);
}

function Refresh() {
    location.reload();
}

function LoginClick() {
    ShowPopup("#loginpopup");
}

function SendChatMessage() {
    var message = $("#chatmessage").val();

    if (message === "") {
        return Notification("Please enter a message", "Error", 3000);
    }

    if (ChatCooldown === true) {
        return Notification("You are on cooldown", "Error", 3000);
    }

    superagent.post("/api/chat/send")
        .send({
            "message": message
        })
        .end((Error, Result) => {
            if (Error) {
                console.log(Error);
            }

            if (Result.body.error) {
                Notification(Result.body.message, "Error", 3000);
                return;
            }
            
            var ChatMessage = $('<div class="chatmessage" style="display: none;"></div>');

            ChatMessage.html(`
                <div class="chatmessage align">
                    <img style="margin-right: 5px;" class="userprofile" src="${Thumbnail}">
                    <p class="texthover">${Username}</p>
                </div>
                <ul>${message}</ul>
            `);

            $('.chatholder').prepend(ChatMessage);

            ChatMessage.slideUp(500, function() {
                $(this).slideDown(500);
                $('.chatholder').scrollTop($('.chatholder')[0].scrollHeight);
            });

            $("#chatmessage").val("");

            ChatCooldown = true
            setInterval(() => {
                ChatCooldown = false
            }, 5000);
        });
}

function GetChatMessages() {
    superagent.get("/api/chat/get")
        .end((Error, Result) => {
            if (Error) {
                console.log(Error);
            }

            if (Result.body.messages) {
                $('.chatholder').empty();

                Result.body.messages.forEach(message => {
                    var ChatMessage = $('<div class="chatmessage"></div>');

                    ChatMessage.html(`
                        <div class="chatmessage align">
                            <img style="margin-right: 5px;" class="userprofile" src="${message.thumbnail}">
                            <p class="texthover">${message.username}</p>
                        </div>
                        <ul>${message.message}</ul>
                    `);

                    $('.chatholder').prepend(ChatMessage);
                });

                $('.chatholder').scrollTop($('.chatholder')[0].scrollHeight);
            }
        });
}

function LoginButton1Click() {
    var username = $("#loginusername").val();

    if (username === "") {
        return Notification("Please enter your username first", "Error", 3000);
    }

    superagent.post("/api/login/get-code")
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
    superagent.post("/api/login/check-code")
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
  
$(document).ready(function() {
    $("#closeloginpopup").on('click', function() {
        HidePopup("#loginpopup");
    });

    $("#closeloginpopup2").on('click', function() {
        HidePopup("#loginpopup2");
    });

    $("#loginphrase").on('click', function() {
        Copy($("#loginphrase").val());
        $("#loginphrase").select();
    });

    GetChatMessages();
    setInterval(GetChatMessages, 5000);
});