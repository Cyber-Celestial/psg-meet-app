# psg-meet-app
## Project Description
This is a meeting app where we have established a peer to peer connection for transfer of data using webRTC protocols . We have used the socket.io framework to set up a signalling server.

## Outline of the project
This project has the following files , which has the following data - <br/>
i)index.html - Home page , used to create new meetings<br/>
ii)action.html - Meet page , which contains an instance of the meet for every unique meeting id<br/>
iii)App.js - Module which handles p2pconnections between users<br/>
iv)Server.js - Module which contains the code for the signalling server which facilitates the p2p connection<br/>
Apart from this , we have a few folders which contain other resources like images , bootstrap files which are required for the project.


## What can this do? 
i) Voice and video call with multiple peers<br/>
ii) Common chatbox for text transfer<br/>
iii) Share screen to users<br/>
iv) Share files<br/>

## Pre-requisites for Hosting the Server on the Machine
i)The Machine must have node js installed.

## Extensions to be installed in visual stuido code(Makes editing and debugging easier)
i)HTML and CSS3 extension.<br/>
ii)Live Server extension.<br/>

## Executing the program
i) Clone the repository or download the zip file of the project.<br/>
ii) Open the terminal and change directory to the folder where the project is stored.<br/>
iii) Type on terminal commands , "npm install" "npm install express" and "npm install nodemon" to install node modules.<br/>
iv) Run the command 'npm start' on the terminal to start the server. It will run on port 5000 by default.<br/>
v) Open your web browser and type in 'http://localhost:5000/index.html' to launch the index page of the app.<br/>

## Hosting
The Application is hosted on heroku , and can be accessed using the link https://psg-meet-app.herokuapp.com/

