# Table of Contents

- [Problem and Context](#problem-and-context)
  - [1.1 Background](#11-background)
  - [1.2 The Gap in Existing Tools](#12-the-gap-in-existing-tools)
  - [1.3 Project Overview](#13-project-overview)
  - [1.4 Position of the Solution](#14-position-of-the-solution)
    - [Existing Solutions:Weaknesses and Gaps](#existing-solutionsweaknesses-and-gaps)
      - [Improvements over GPlates](#improvements-over-gplates)
    - [Avantages of Developing a Dedicated New Tool](#avantages-of-developing-a-dedicated-new-tool)
- [Identification of Major Agents](#identification-of-major-agents)
  - [2.1 Overview of main agents](#21-overview-of-main-agents)
  - [2.2 Potential Clients and Their Roles](#22-potential-clients-and-their-roles)
- [Main goals](#main-goals)
  - [Constraints](#constraints)
- [Technical Analysis](#technical-analysis)
  - [4.1 Key Challenges and objectives](#41-key-challenges-and-objectives)
  - [4.2 High-Level Architecture Overview](#42-high-level-architecture-overview)
  - [4.3 Back-End Layer (Django + HTMX)](#43-back-end-layer-django--htmx)
  - [4.4 3D Rendering & Front-End Visualization (Three.js)](#44-3d-rendering--front-end-visualization-threejs)
  - [4.5 High-Performance Geometry: Rust → WebAssembly](#45-high-performance-geometry-rust--webassembly)
  - [4.6 Supporting Tools & Methodologies](#46-supporting-tools--methodologies)
  - [4.7 Comparison of Final Stack vs. Potential Alternatives](#47-comparison-of-final-stack-vs-potential-alternatives)
  - [4.8 Justification of Each Final Choice](#48-justification-of-each-final-choice)
  - [4.9 Potential Limitations et Future Enhancements](#49-potential-limitations-et-future-enhancements)
- [User Stories, Technical Stories and MVP](#user-stories-technical-stories-and-mvp)
  - [5.0 Overview table](#50-overview-table)
  - [5.1 Basics](#51-basics)
    - [User account management](#user-account-management)
    - [Startup & Project Creation](#startup--project-creation)
    - [Saving the Project](#saving-the-project)
    - [Load Project](#load-project)
  - [5.2 Drawing on the sphere](#52-drawing-on-the-sphere)
    - [Node by node drawing](#node-by-node-drawing)
    - [Node by node editing](#node-by-node-editing)
    - [Logic feature editing](#logic-feature-editing)
    - [Pencil drawing](#pencil-drawing)
  - [5.3 Project, feature data and tools](#53-project-feature-data-and-tools)
    - [Measuring tool](#measuring-tool)
    - [Tracking of various informations of the project](#tracking-of-various-informations-of-the-project)
    - [Tracking of various information of different feature](#tracking-of-various-information-of-different-feature)
    - [Feature history](#feature-history)
  - [5.4 Making & Moving Plates](#54-making--moving-plates)
    - [Creating initial cratons](#creating-initial-cratons)
    - [Creating the initial supercontinent](#creating-the-initial-supercontinent)
    - [Arbitrary editing](#arbitrary-editing)
    - [Flowlines and mid ocean ridges](#flowlines-and-mid-ocean-ridges)
    - [Defining Rifts](#defining-rifts)
    - [adding failed rifts](#adding-failed-rifts)
    - [Splitting a Feature](#splitting-a-feature)
    - [Making the plates drift](#making-the-plates-drift)
    - [Movement preview](#movement-preview)
    - [Adding Ocean Crust](#adding-ocean-crust)
    - [Adding subduction zones](#adding-subduction-zones)
    - [Subduction of oceanic crust and other features](#subduction-of-oceanic-crust-and-other-features)
  - [5.5 Colliding](#55-colliding)
    - [Collision detection](#collision-detection)
    - [Small collision management](#small-collision-management)
    - [Major collision management](#major-collision-management)
  - [5.6 Feature indications](#56-feature-indications)
    - [Island Arcs indication](#island-arcs-indication)
    - [Hotspot placement and trail indication](#hotspot-placement-and-trail-indication)
    - [Large ignious provinces](#large-ignious-provinces)
    - [Orogenies indications](#orogenies-indications)
  - [5.7 Static tools](#57-static-tools)
    - [automatic oceanic shelf carving](#automatic-oceanic-shelf-carving)
    - [dynamic feature detailing](#dynamic-feature-detailing)
    - [dynamic topology generation](#dynamic-topology-generation)
    - [Expanded topologic tools](#expanded-topologic-tools)
  - [5.8 Options and export](#58-options-and-export)
    - [switch between 3D and projection](#switch-between-3d-and-projection)
    - [change color settings](#change-color-settings)
    - [Importing reference](#importing-reference)
    - [Final Display Adjustments](#final-display-adjustments)
    - [Exporting Maps & Timelapse](#exporting-maps--timelapse)
  - [5.9 Technical Stories](#59-technical-stories)
- [Methodology, Organization of the Project](#methodology-organization-of-the-project)
  - [6.1 Minimum Viable Product : Barebone vector animation tool on a sphere](#61-minimum-viable-product--barebone-vector-animation-tool-on-a-sphere)
  - [6.2 Phases of Development](#62-phases-of-development)
    - [Phase 1: Project Setup & MVP Definition](#phase-1-project-setup--mvp-definition)
    - [Phase 2: MVP Implementation](#phase-2-mvp-implementation)
    - [Phase 3: Polished MVP and advanced vector tooling](#phase-3-polished-mvp-and-advanced-vector-tooling)
    - [Phase 4: tectonic featureset implementation](#phase-4-tectonic-featureset-implementation)
    - [Phase 5: Automatic feature indication and smarter collisions](#phase-5-automatic-feature-indication-and-smarter-collisions)
    - [Phase 6: Advanced project settings, export and tools](#phase-6-advanced-project-settings-export-and-tools)
    - [Phase 7: Wrap-up of Version 1.0](#phase-7-wrap-up-of-version-10)
    - [Phase 8: Post tfe features](#phase-8-post-tfe-features)
  - [6.3 Agile Tooling](#63-agile-tooling)
  - [6.4 Flexibility and Risk Management](#64-flexibility-and-risk-management)
- [Validation Strategy](#validation-strategy)

# Problem and Context

## 1.1 Background
Worldbuilding is the act of creating fictional settings. It is most often used by writers, DMs, game makers and artists to ground the stories they create, but a lot of other projects can benefit from well crafted settings and some people (like me) just practice worldbuilding in itself for fun. 
But worldbuilding is in itself an aglomeration of many other, more specific practices like conlanging (creating languages), neography (creating writing systems) or mapmaking (creating fictional maps) and many more.
One pretty well known tricks that can be used to impart complexity, richess and a sens of belivablitly to any worldbuilding project is to make it's history. Instead of building the thing only at the state that matters to you, you create it at an arbitrary point in the past and artificially simulate it's evolution up until the point that interests you. This process is way more time consuming but also more complicated as you have to understand how things like languages, alphabets, ecosystems or geology evolve over time. 
But for some worldbuilders this extra effort is worth it.
For simulating the evolution of a lot of things, paper, motivation and a great amount of knowledge is enough. But when we talk about the evolution of the geography of a planet, it gets way more complicated as the finaly product is basically a small film of continents moving on a sphere (anybody that can make that with paper gets my undying respect).

Making geological history of maps is still, even in the worldbuilding hobby, a pretty niche subject, despite the fact that geography is probably one of the highest building block of any worldbuilding projects.
## 1.2 The Gap in Existing Tools
The main reason, in my opinion, that geological histories are sadly not as common in the worldbuilding community is because there curently is a gap in the existing available tools to do so :

- **Fantasy map tools** (World Anvil, Wonderdraft, Inkarnate):
   These tools are mostly made for artistic design and story building. They can be very useful to annotate maps or follow the progression in a story but they provide very few ways to animate the map, draw it directly on a sphere and absolutely no way to manipulate the geography of the map like real tectonic plates.
- **Scientific software** (GPlates):
   This is a professional-level application for real plate tectonics. It is extremely powerful but geared toward Earth’s data and workflows. It might be too technical for most worldbuilders and it is not designed to handle fictional mapmaking. Using it in this way has its own quirks.

I feel like there is a real need and a real opportunity for a tool geared towards fictional mapmaking that helps worldbuilder make scientifically grounded geographic histories without having to deal with the quirks and complexity of current scientific software and therefore help them make their setting more rich and more belivable.
This is this objective that this project is going to pursue.

## 1.3 Project Overview
Clia (from the contraction of *Clymene* and *Lapetus*, the parents of the titan Atlas) will be a web application that allows users that are not familiar with advanced scientific tooling to easily make geological histories of fictional maps.

The **lack of a specialized tool** for **fictional geologic history animation** presents an opportunity to:
- **Simplify** advanced scientific tools (like GPlates) into a **streamlined** web app suited for non-experts.  
- Provide an **educational bridge** between fantasy creation and real science, helping worldbduilders **enriching** their fictional settings
- Explore new and exciting technologies to solve technical challenges, be it in methematics and geometry or in user interaction.

## 1.4 Position of the Solution

### Existing Solutions:Weaknesses and Gaps
- **GPlates** :
   - Scientific tool made for earth based tectonic .
   - Most of the features of GPlates are not useful in the worldbuilding process
   - GPlates is not made for worldbuilding, using it in this way can be tedious and cumbersome. 
   - Very few vector drawing capabilities
- **Artistic Tools** :
   - Mapmaking specific tools (inkarnate, worldAnvil ...) :
      - Very few vector drawing capabilities
      - Very few to no animation capabilites
      - Almost allways impossible to draw on a sphere
      - No geologic understanding
   - Generic Drawing and animation tools (Illustrator, Photoshop, inkscape ...) :
      - Inability to work on a sphere
      - No geologic understanding
- **Blender** can do anything in 3D but lacks built-in geologic processes.
   - Very few vector drawing capabilites
   - No geologic understanding
   - Most of the features of Blender are not useful in the worldbuilding process

A **hybrid approach** is needed: an intuitive “draw-and-animate” tool with built-in geologic understanding and allows the user to draw and animate with a complete set of vector tools on a sphere

#### Improvements over GPlates
As GPlates is the most direct equivalent to the Clia project I thought it was a good idea to detail specifically the improvements that can be made over it :
   - not having to create collections :
      - The user selects the type of feature they want to draw
      - Every new feature is automatically labelled and manage
   - not having to save manually each collection
      - The entire project can be saved in one action
   - not having to manage IDs
      - The project manages the grouping of features into plates
      - manual ID management is no longer needed
   - not having to manually clone and modify plate once split happens
      - Feature splitting automatically creates new plates and assignes corresponding features
      - No need to manually clone and delete verteces to split a feature into multiple
   - not having to specify start time and end time for every feature
      - The keyframing of the features allows to manage their age without user interaction
   - not having to maintain the rotation.rot file
   - not having to manually manage flowlines, mid ocean ridges and newly created ocean crust
      - The process of adding and managing these features is treamlined and automated
   - Informing the user of where features should go based on their decisions (subduction zones, island arcs, orogenies)
   - automatically delete subducted features

### Avantages of Developing a Dedicated New Tool
1. **User-Centric Interface** (simple “draw & move” approach).  
2. **Focus on Fictional Workflows** (imagined tectonic histories, quick plate splits).  
3. **Dynamic Evolution** (animate entire planet histories).  
4. **Web-Based Integration** (Django, HTMX, Rust→WASM).  
5. **Community Involvement** (lower barrier than GPlates for hobbyists).

---

# Identification of Major Agents

## 2.1 Overview of main agents
1. **Users** :
      **Worldbuilders**:
         Worldbuilders are simply people that want to create worlds, for any reason. They are the main target for this tool and while the worldbuilding community is quite large, making geological history is still a niche topic. This is why this project has to cater to both the casual worldbuilder that want to try their hand at geologic histories and the hardcore user who want to explore alternatives to GPlates.
      **Educators**:
         While this application is mainly targetted at worldbuilders, the opportunity of having an easy to use tool to represent tectonic interaction can be really useful for anybody wanting to teach the basics of tectonic principles.
2. **Worldbuilding Pasta**:
   Worldbuilding Pasta is the name of a blog focused on scientifically acurate worldbuilding. This blog is by far the best ressource on the use of GPlates as a tool for fantasy geological history making [Making an apple pie from scratch V](https://worldbuildingpasta.blogspot.com/2020/06/an-apple-pie-from-scratch-part-v.html). The writer of the blog has been contacted and has expressed interest in the project but is currently waiting for the project to be better defined in order to decide if they want to involve themselves in the project. Their input on this project could be an amazing asset and they will be recontacted as the project develop in order to keep them informed.
3. **Artifexian**:
   Artifexian is a worldbuilding youtuber that has made a video serie based on Worldbuilding Pasta's blog. They have been contacted a year ago when this project was in its infancy and they expressed interest in it. I have try to recontact him to no avail but I will try to do so again as the project develops. The experience of Artifexian on worldbuilding could be really helpfull and this project could possibly also benefit from the exposure to his community.
4. **Me / Project Owner**  
   Since I have failed to convince the interested parties in taking the role of clients for this project, this role will have to be filled by myself for the time beeing. I nonetheless consider myself to be a worldbuilder and this project is one that is truely near and dear to my heart and I am not unhappy to keep ownership over it. Furthermore, the real client, in the end, is the worldbuilding community.

## 2.2 Potential Clients and Their Roles
| **Agent**  | **Background** | **Interest & Status** | **Role** |
|:--------------|:----------------------|:------------|---|
| **Artifexian**   | Produces worldbuilding, cartography, and conlang videos on Youtube | Showed interest in the project a year ago, but has not been reachable since the project has started | None currently but might act as an expert or help expose the project to a wider audience. Furethermore, the Worldbuilder's log video serie is used as one of the main ressources for the worldbuilding/geologic side of the app|
| **WorldbuildingPasta**      | Blogger focused on advanced worldbuilding and specialist in the use of GPlates for fictional geologic history | Enthusiastic but wants more details before involving themselves more in the project.| None currently but might act as an expert once the project becomes more defined, the Worldbuilding Pasta blog is a really important inspiration for this project.|
| **Me**| Student at Ephec with an interest in web developement| Amateur worldbuilder | current developer and owner of the project, will act as main client for the time beeing |
| **The worldbuilding community** (target users)| Anybody that has interest in worldbuilding | the few contacts I had with members of the community were positive, The project will have to be in a more advanced state before expositing it to the broader community | the project purpose is to be shared and used by as many people as possible, but setting ways of involving the community in the feedback process (discord server) is premature |

---

# Main goals

![Clia_mockup_1](https://github.com/user-attachments/assets/142d2608-ab6e-439a-9657-761a10a104f7)

## Constraints
Clia is a passion project, and since I'm my own client it important for me that I can easily maintain it. While the current market for this project is pretty niche, one of my goals is to allow more people to delve into the fascinating world of hard neogeography (hard means with a hard scientific backing) and therefore the problem of scaling should be taken very seriously.




Constraints :
justification fabrication locale
   - const :ne pas maintenir un serveur (couteux)
   - const :ne pas que le serveur soit un frein 
   - const :ne pas a se préoccuper de la puissance et du scaling 
justification web vs application bureau
   - confort
   - portabilité
   - sécurité
   - mise a jour
implique : frontend, backend, database

justification rust : better webassembly toolchain, calcul math différent de code admin websi
tout ce vaut, pas de mauvais choix
regarder + les renderer

regarder qu'est-ce qui fonctionne le mieux avec le renderer comme frontend

pas utile de regénérer le fichier à partir d'une db relationelle => fichier

grosses databases qui stoque bien les données
--> postgresql pas besoin d'une technologie de db particulière, choix polyvalent

gérer le local storage

 ==> il n'y a rien qui me retient de prendre une solution par défaut

renseignement backend batteries included (rust)

---

# Technical Analysis

## 4.1 Key Challenges and objectives
- Balancing **Accessibility** and **Scientific accuracy** : This project should be available and usable by the largest number of worldbuilder while still beeing a real help to making scientifically robust geologic history. Things like the UI and the workflow should not hinder the accuracy of the tool while still having a small learning curve and encouraging an iterative process and experimentation.
- Balancing **Performance** and **Complexity** : The hardware of the user should not be a roadblock to them using the service, it should feel fast in order to not stop the creative process. At the same time, things like manipulation and colision checks of polygons on a sphere can be complexe and computationally heavy. Solutions have to be found in order to manage those two aspects of the project.
- Focusing on what is important : The premice of this project is quite complexe, therefore an effort should be made in order to avoid unnecessary complexity where it is possible.

## 4.2 High-Level Architecture Overview
We need a browser-based solution that:
1. **Renders a 3D globe** (Three.js) for interactive plate drawing.  
2. **Computes geometry** in Rust→WASM for performance.  
3. **Stores data** in Django, employing HTMX for partial page updates.  
4. **Scales** with agile increments.

## 4.3 Back-End Layer (Django + HTMX)
A Python-based framework for robust data handling and quick partial updates:
- **Django**: Admin, ORM, security.  
- **HTMX**: Enables partial HTML updates with minimal JavaScript overhead.

## 4.4 3D Rendering & Front-End Visualization (Three.js)
- **Three.js** for an interactive 3D globe.  
- Large community, flexible scene management, easy to integrate with HTML/JS.

## 4.5 High-Performance Geometry: Rust → WebAssembly
- **WebAssembly** for near-native performance in numeric tasks.  
- **Rust** ensures memory safety and strong tooling.  
- Handles polygon splitting, Euler rotations, collisions, etc.

## 4.6 Supporting Tools & Methodologies
- **Database & ORM**: Likely PostgreSQL for multi-user or advanced queries.  
- **Synchronous Django** acceptable for a single-user or small group.  
- **Security**: Django’s built-in session/auth + standard web best practices.

## 4.7 Comparison of Final Stack vs. Potential Alternatives

| **Layer**         | **Chosen**                         | **Alternatives**                            | **Reason**                                                 |
|-------------------|------------------------------------|---------------------------------------------|------------------------------------------------------------|
| Back End          | Django + HTMX                      | Flask, FastAPI, FastHtml, Node.js                     | Built-in admin, robust security, partial updates with HTMX.  |
| Front End         | Three.js + minimal JS + HTMX        | React/Vue SPAs, Babylon.js, CesiumJS        | Straightforward 3D rendering, no heavy SPA needed.         |
| Geometry          | Rust → WASM                        | C/C++ → WASM, AssemblyScript, Go → WASM     | Safe concurrency, performance, mature Rust→JS ecosystem.   |
| 3D Visualization  | Three.js                           | Babylon.js, raw WebGL, other 3D engines     | Large community, flexible, examples for custom geometry.   |

## 4.8 Justification of Each Final Choice
1. **Django + HTMX**: Quick to set up, proven reliability, partial updates.  
2. **Rust → WASM**: Safe, high-performance math for plate-tectonic logic, good integrated web assembly toolchain
3. **Three.js**: Well-documented 3D library for a custom globe approach.  

## 4.9 Potential Limitations et Future Enhancements
- **Web assembly to js pipeline** : with a lot of frequent updates the serialization/deserialization of data between javascript and the web assembly might quickly become a bottleneck, the use of shared memory and webworkers might help alliviate this problem
- **Collaboration**: Real-time collaboration might need Django Channels or websockets.  
- **WebGPU**: Future improvement for massive polygons or advanced rendering.

---

# User Stories, Technical Stories and MVP
## 5.0 Overview table

|Code|Name|Importance|Complexity|MVP|
| --- | --- | --- | --- | --- |
|**Bas1**|User account management|Must|very low||
|**Bas2**|Startup & Project Creation|Critical|Low||
|**Bas3**|Saving the project|Must|Low||
|**Bas4**|Load project|Must|Low||
|**Draw1**|Node by Node drawing|Critical|Medium||
|**Draw2**|Node by Node editing|Critical|Medium||
|Draw3|Logic feature editing|Should|Medium-high||
|Draw4|Pencil drawing|Nice|Medium||
|PFDT1|Measuring tool|Should|Medium-low||
|**PFDT2**|Tracking of various informations of the project|Should|Low||
|**PFDT3**|Tracking of various informations of different feature|Should|Low||
|PFDT4|Feature history|Nice|Medium-high||
|MM1|Creating initial cratons|Should|High||
|**MM2**|Creating the initial supercontinent|Critical|High||
|MM3|Arbitrary editing|Should|high||
|MM4|Flowlines and mid ocean ridges|Nice|Crazy||
|**MM5**|Defining Rifts|Should|High||
|MM6|Adding failed rifts|Nice|Pretty High||
|**MM7**|Splitting a feature|Should|Crazy||
|**MM8**|Making the plates drift|Critical|Very high||
|MM9|Movement Preview|Should|Crazy||
|MM10|Adding Ocean Crust|Nice|Crazy||
|MM11|Adding subduction zones|Should|High||
|MM12|Subduction of oceanic crust and other features|Nice|F it we ball||
|**Col1**|Collision detection|Should|Crazy||
|Col2|Small collision management|Nice|Crazy||
|Col3|Major collision management|Nice|Crazy||
|FIn1|Island Arcs indication|Nice|Very high||
|FIn2|Hotspot placement and trail indication|Should|High||
|FIn3|Large ignious provinces|Should|Very high||
|FIn4|Orogenies indications|Nice|I am sorry||
|ST1|automatic oceanic shelf carving|Optional|Very high||
|ST2|dynamic feature detailing|Optional|Very high||
|ST3|dynamic topology generation|Optional|Thinking about it is a bad idea||
|ST4|Expanded topologic tools|Nice|Pretty high||
|OE1|switching between 3D and projection|Must|High||
|OE2|change color settings|Should|Medium|
|OE3|Importing reference|Nice|Medium||
|OE4|Final Display Adjustments|Should|Low||
|**OE5**|Exporting Maps & Timeline|Critical|Medium high||


## 5.1 Basics

### User account management
> "As a user, I want to have access to all the usual account managements features expected from modern web applications in order to access and load my projects that are saved on the server"

**Acceptance Criteria**:
- [ ] Create account
- [ ] Log in
- [ ] Log off
- [ ] Modify account informations
- [ ] Recover account

**Importance**: Must have
**Complexity**:very low

### Startup & Project Creation
> “As a user, I want to initialize a new tectonic project so I can begin designing a planet’s geologic timeline from scratch.”

**Acceptance Criteria**:  
- [ ] Create a new project.  
   - [ ] Give the project a name
   - [ ] Set various project settings (gravitational constant, planet radius)
- [ ] Display the blank default globe to start working

**Importance**:Critical
**Complexity**:Low

### Saving the Project
> “As a user, I want to save my current project data so I can reopen it later.”

**Acceptance Criteria**:  
- [ ] ‘Save Project’ action storing the various features of the project
- [ ] If the project already exists, update its state
- [ ] Create a new entry in the database if the project is new


**Importance**: Must have
**Complexity**: Low

### Load Project
> “As a user, I want to be able to open one of my saved projects"

**Acceptance Criteria**:  
- [ ] A ‘Load project’ action to open an existing project
- [ ] Displays a list of the user's current projects

**Importance**: Must have
**Complexity**: Low

---
## 5.2 Drawing on the sphere

### Node by node drawing
> "As a user, I want to be able to put down a series of nodes that gets connected into a polygon"

**Importance**: Critical
**Complexity**: Medium

### Node by node editing
> "As a user, I want to be able to displace or delete existing nodes and add a node between two existing nodes in order to change the shape of a feature"

**Importance**: Critical
**Complexity**: Medium

### Logic feature editing
> "As a user, I want to be able to edit a feature by drawing an other feature and applying a logical opperation between the two (additive, substrative, ...)"

**Importance**: Should have
**Complexity**: Medium-high

### Pencil drawing
> "As a user, I want to be able to draw a line on the globe and have it automatically convert in a serie of points"

**Importance**: Nice to have
**Complexity**: Medium

---
## 5.3 Project, feature data and tools

### Measuring tool
> "As a user, I want to have access to a tool that allows me to measure the distance between two points"

**Acceptance Criteria**
- [ ] the measuring tool can be used to acurately measure distances on the sphere

**Importance**: Should have
**Complexity**: Medium-low

### Tracking of various informations of the project
> "As a user, I want to be able to track multiple informations about the world"

**Acceptance Criteria**
- [ ] Tracking the total land coverage of the planet

**Importance**: Should have
**Complexity**: Low

### Tracking of various information of different feature
> "As a user, I want to be able to click on a feature to see multiple informations about it"

**Acceptance Criteria**
- [ ] Get the age of the feature
- [ ] Get the current speed of the feature
- [ ] Get the area of the feature (if pertinent)
- [ ] Get various geometric informations about the feature

**Importance**: Should have
**Complexity**: low

### Feature history
> "As a user, I want to be able to access a small history of the various events that have happened to a feature"

**Importance**: Nice to have
**Complexity**: medium-high

---
## 5.4 Making & Moving Plates

### Creating initial cratons
> “As a user, I want to be able to draw cratons on the sphere to lay out the base of the initial supercontinent"

**Acceptance Criteria**:  
- [ ] A craton option that allows the user to add a new craton on the sphere
- [ ] Confirming the shape of the craton

**Importance**: Should have
**Complexity**: high

### Creating the initial supercontinent
> "As a user, I want to be able to surround the cratons with the initial continental crust"

- [ ] A continental crust option that allows the user to surround the cratons with a new polygon
- [ ] Check if the supercontinent correctly surrounds every cratons

**Importance**: Critical
**Complexity**: high

### Arbitrary editing
> "As a user, I want to be able to create or modify features without having to justify it with tectonic history"

- [ ] A "generic feature" option that allows the user to add custom features
- [ ] The user can define how these new features interact with the tectonic process

**Importance**: Should have
**Complexity**: high

### Flowlines and mid ocean ridges
> "As a user, I want to see flowlines between diverging plates as well as the mid ocean ridge"

**Acceptance Criteria**:  
- [ ] flowlines appear between divergent plates
- [ ] notify the user if the flowlines cross each other (bad practices)
- [ ] keep track of the mid ocean ridge as the plates moves

**Importance**: Nice to have
**Complexity**: Crazy

### Defining Rifts
> “As a user, I want to draw a rift line across a continent so it can split into two separate plates.”

**Acceptance Criteria**:  
- [ ] draw a polyline through a plate
- [ ] extrapolate the polyline to features that needs to be split too (island arcs, oceanic plate)
- [ ] check that the rift doesn't goes through any cratons

**Importance**: Should have
**Complexity**: high

### adding failed rifts
> "As a user, I want to draw a polyline coming from either a node of a rift or the side of a plate to define a failed rift. This failed rift can be used as the template for full rifts"

**Acceptance Criteria**:  
- [ ] I can draw a polyline with a node of a continental plate or rift as starting point
- [ ] I can reactivate a failed rift and extend it into a full rift

**Importance**: Nice to have
**Complexity**: Pretty high
### Splitting a Feature
> “As a user, I want to split an existing plate along the rift line so each side can be considered as different plates and move independently"

**Acceptance Criteria**:  
- [ ] the two split plates are considered as two and move independently

**Importance**: Should have
**Complexity**: Crazy

### Making the plates drift
> "As a user, I want to define a direction, rotation and a speed in order to make a plate drift over a set period of time"

**Acceptance Criteria**:
- [ ] inputing a speed, a rotation, a direction and a length of time to correctly displaces the plate
- [ ] every features that are associated to the plate move in sinc with the plate

**Importance**: Critical
**Complexity**: Very high

### Movement preview
> "As a user, I want to be able to preview the location of the plate while I input the tranformations, as a shadow of the continent or as preview lines"

**Acceptance Criteria**:
- [ ] While the user is inputing the tranformations, an accurate preview of the result is displayed
- [ ] The preview is reactive and accurate

**Importance**: Should have
**Complexity**: Crazy

### Adding Ocean Crust
> “As a user, i want the space between diverging plates to be filled with oceanic crust"

**Acceptance Criteria**:  
- [ ] oceanic crust gets created between divergent plates
- [ ] the new oceanic crust gets added to the plate on their side of the mid ocean ridge
- [ ] the age of the oceanic crust is kept track off

**Importance**: Nice to have
**Complexity**: crazy

### Adding subduction zones
> "As a user, I want to mark convergent boundaries as subduction zones that will inform the movement of the plates"

**Acceptance Criteria**:  
- [ ] I can draw a polyline that is considered as a subduction zone

**Importance**: Should have
**Complexity**: high

### Subduction of oceanic crust and other features
> "As a user, I want to see features like the oceanic crust disappear as they get subducted"

**Acceptance Criteria**:
- when a feature that would not create collisions (oceanic plates, mid ocean rifts ...) crosses a subduction zone, it's geomtry gets updated in order to give the impression that it "dissapears" under the subduction zone

**Importanced**: Nice to have
**Complexity**: F it we ball

---
## 5.5 Colliding
### Collision detection
> "As a user, I want to be notified when major features collide (mainly island arcs and plates)"

**Acceptance Criteria**:
- [ ] the application correctly notifies the user when a collision happens
- [ ] the time of the collision is recorded
- [ ] the animation creates a step at the time of the collision

**Importance**: Should have
**Complexity**: Crazy

### Small collision management
> "As a user, when a minor collision occurs (island arc vs plate), i want the island arc to automatically be added as "accreted terrain" to the plate"

**Acceptance Criteria**:
- [ ] the island arc turns into accreted terrain
- [ ] the new accreted terrain is added as a feature of the colliding plate
- [ ] the surface of the accreted terrain correspond to the expected surface of the island arc at the time of collision

**Importance**: Nice to have
**Complexity**: Crazy
### Major collision management
>"As a user, when a major collision occurs (plate vs plate), i want to be able to keep track of the features that "disappear in this collision" as well as manage the various deformations of geometry that occurs in the collision."

**Acceptance Criteria**:
- [ ] the features caugh in the collision are remembered (for things like tracking fossils)
- [ ] a zone of orogenie is suggested 
- [ ] the user can define a collision rift between the two colliding plates
- [ ] the user can modify the geometry of the newly formed plate

**Importance**: Nice to have
**Complexity**: Crazy

---
## 5.6 Feature indications

### Island Arcs indication
>"As a user, I want to be able to see the expected location and size of island arcs as oceanic crust get subducted"

**Acceptance Criteria**:
- [ ] a zone is correctly displayed behind a subduction zone to indicate the location of expected island arcs
- [ ] with the simulation the area of the zone (in km^2) correctly evolves based on the formula : length of the IA (km) x age of IA (in Mya))/2

**Importance**: Nice to have
**Complexity**: Very high

### Hotspot placement and trail indication
> "As a user, I want to be able to place hotspots on the globe and to see the zone of the expected trails of the volcanic activity"

**Acceptance Criteria**:
- [ ] I can correctly see the path of volcanic activity left by the hotspot
- [ ] The expected location of remaining geologic traces of the hotspot are indicated with a sort of "teardrop" shape

**Importance**: Should have
**Complexity**: High

### Large ignious provinces
> "As a user, I want to be able to draw a large ignious province and choose if the province is active or inactive"

**Acceptance Criteria**:
- [ ] have access to a large ignious province tool
- [ ] the large ignious province can be set as active or inactive
- [ ] the age of the ignious province is remembered

**Importance**: Should have
**Complexity**: Very high

### Orogenies indications
> "As a user, I want to be informed of the expected locations of the various orogenies of the plates based on their movements"

**Acceptance Criteria**:
- [ ] locations of expected orogenies are dispayed on the plates
- [ ] active/passive state of the orogenies can be set
- [ ] the age of the orogenies is kept track of, as well as the time since the orogenie was active

**Importance**: Nice to have
**Complexity**: I am sorry

## 5.7 Static tools
those are options that are not relevant in the actual simulation process but allow the user to polish a specific state of the map.

### automatic oceanic shelf carving
> "As a user, I want to have an option to autmatically carve the appropriate depth into the oceanic shelf in order to have a more accurate picture of the actual landmasses

**Acceptance Criteria**:
- [ ] The automatic oceanic shelf carving creates a new layer
- [ ] The result of the carving is correct

**Importance**: Optional
**Complexity**: Very high

### dynamic feature detailing
> "As a user, I want to be able to easilly detail the features of my project"

**Acceptance Criteria**:
- [ ] the feature detailing adds nodes to edges to make them more iteresting and natural
- [ ] the ammount of detailing can be managed

**Importance**: Optional
**Complexity**: Very high


### dynamic topology generation
> "As a user, I want the application to be able to give me a rough idea of the topology of the continents and the ocean 

**Acceptance Criteria**:

**Importance**: Optional
**Complexity**: thinking about it is a bad idea

### Expanded topologic tools
> "As a user, I want to be able to draw the topology of my map directly on the sphere with a set of vector tools"

**Acceptance Criteria**:
- [ ] a lot of cool stuff

**Importance**: Nice to have
**Complexity**: Pretty high

---
## 5.8 Options and export

### switch between 3D and projection
> "As a user, I want to be able to switch my view between the 3D view of the globe and a projection, as well as change the origin point of the projection"

**Acceptance Criteria**:
- [ ] switch between 3D view and projection view
- [ ] change the type of projection
- [ ] change the origin point of the projection

**Importance**: Must have
**Complexity**: high

### change color settings
> "As a user, I want to be able to change the fill and outline colors of different features as well as enable a heatmap colloration for features where age are important"

**Acceptance Criteria**:
- [ ] modify the fill color of a feature
- [ ] modify the outline color of a feature
- [ ] color features based on their age with a heatmap

**Importance**: Should have
**Complexity**: medium

### Importing reference
> “As a user, I want to overlay an equirectangular image on the globe for reference.”

**Acceptance Criteria**:  
- Upload an image.  
- Overlay toggles (opacity, visibility).  
- Aids in aligning features to real or custom maps.

**Importance**: Nice to have
**Complexity**: medium

### Final Display Adjustments
> “As a user, I want to toggle/hide features to produce a clear map.”

**Acceptance Criteria**:  
- Layers panel for show/hide (continents, orogenies, hotspots, etc.).  
- Opacity controls.  
- Option to remove lat/long grid or switch projection.

**Importance**: Should have
**Complexity**: low

### Exporting Maps & Timelapse
> “As a user, I want to export snapshots or timelapses of the planet’s tectonic evolution.”

**Acceptance Criteria**:  
- Single snapshot exports (image/vector).  
- Time-sequence exports (e.g., every 10 My).  
- Common projections (Equirectangular, Mollweide) or 3D globe.  
- Preserves layer colors and time-based geometry.

**Importance**: Critical
**Complexity**: medium high

## 5.9 Technical Stories

---

# Methodology, Organization of the Project

## 6.1 Minimum Viable Product : Barebone vector animation tool on a sphere

Bas1
Bas2
Bas3
Bas4
Draw1
Draw2
PFDT2
PFDT3
MM2
MM5
MM7
MM8
Col1
OE5

1. **3D Globe Visualization**  
   - Basic globe in Three.js

2. **Polygon and Polyline Drawing & Storage**  
   - Draw polygonal features on the globe in a "node by node" fashion.  
   - Edit existing polygons in a "node by node" fashion (delete, add, translate)

3. **Translation & Rotation of Polygons**  
   - Select a polygon to **translate** or **rotate** on the globe.  
   - Geometric core (Rust→WASM) handles geometry calculations, returning updated state of features
   - Immediate feedback in the 3D scene.

4. **Feature spliting**
   - split a feature in two along a defined polyline
   - the resulting split features can be edited individually

5. **Keyframe based animation**
   - Pair the transformations of the polygons with keyframes on a timeline
   - Visualize the entire animation
   - Store the animation in the database

6. **Basic account and project management**
   - Users can sign up, log ing ...
   - A new project can be created, named ...

## 6.2 Phases of Development

### Phase 1: Project Setup & MVP Definition
- **Goals**: 
  - Repo structure on GitHub, Django + HTMX skeleton, Rust→WASM toolchain, minimal Three.js globe ...
  - Document the MVP scope in GitHub issues.

### Phase 2: MVP Implementation
- **Goals**:
   - Complete implementation of the MVP
   - Implementation of project settings (i.e : globe size)
   - Testing 
   - Deployment

### Phase 3: Polished MVP and advanced vector tooling
- **Goals**: 
   - Polishing the MVP in order to prepare for feedback (UI, UX)
   - Finish the implementation of the vector drawing tools
   - Complete implementation of the animation features

### Phase 4: tectonic featureset implementation
- **Goals**:
   - Implementation of feature labelization (craton, continental/oceanic crust, rifts, island arcs ...)
   - Implementation of age tracking
   - Plate understanding (translation and edition of multiple features that are considered to be part of the same "plate")
   - Collision detection

### Phase 5: Automatic feature indication and smarter collisions
- **Goals**: 
   - Implementation of automatic feature creation
      - Orogenies
      - Island arcs
      - Hotspot trails
   - Implementation of more complete collision management (island arcs -> accreted terrain, integration of features into orogenies ...)

### Phase 6: Advanced project settings, export and tools
- **Goals**:
   - Implementation of remaining useful tools and settings
   - Implementation of wider export options (png, svg, mp4, gif ...)

### Phase 7: Wrap-up of Version 1.0
- **Goals**:
   - Final deployment of the project
   - bugfixing based on feedback

### Phase 8: Post tfe features
- **Goals**:
   - support
   - Implementation of advanced options and tooling that got left out from the 1.0

## 6.3 Agile Tooling

- **Git + GitHub**:  
  - Branching, pull requests, issues, GitHub Projects.  
- **Clockify (Optional)**:  
  - Time tracking for productivity if helpful.  
- **Frequent Commits & Iteration**:  
  - Each phase yields a working build.  
  - Re-prioritize tasks as needed.

## 6.4 Flexibility and Risk Management
- **Agile, incremental** approach allows re-scoping if complexities arise (math, performance).  
- MVP ensures a baseline deliverable; phases accommodate new ideas or user feedback.

# Validation Strategy
1. **User Types**: Validate with beginner worldbuilders vs. advanced tectonics enthusiasts.  
2. **Precision & Relevance**: Ensure plausible geophysics but not necessarily at the highest geoscientific detail.  
3. **Complexity**: Focus on correct polygon splitting/animation first, advanced processes next.  
4. **Priority**: MVP core (draw polygons, define plates, animate them), then secondary features (flowlines, orogenies).

---

