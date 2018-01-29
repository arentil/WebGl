"use strict";

var gl;
let canvas;

var lights_vao;
var vao;
var bg_vao;
var textures = [];

var bg_texture;
var texture;
var material_ubo;

var lights_ubo;
var ambient_light_ubo;
var matrices_ubo;
var cam_info_ubo;
var viewerAt;
var RotationMatrix = mat4.create();
var scrollStep = 0.5;
var viewerAtZ = 1.0;

var Direction = 
{
	LEFT_TO_RIGHT : 1,
	RIGHT_TO_LEFT : 2
};

function Bullet(pos, directionEnum, xSpeed, rSpeed, baseR, r)
{
	this.pos = pos;
	this.direction = directionEnum;
	this.xSpeed = xSpeed;
	this.rSpeed = rSpeed;
	this.baseR = baseR;
	this.r = r;
};

function compareNum(a, b) 
{
   return b - a;
}

function Float32Concat(first, second)
{
    let first_length = first.length,
        result = new Float32Array(first_length + second.length);
    result.set(first);
    result.set(second, first_length);
    return result;
}

function degToRad(degrees) 
{
  return degrees * Math.PI / 180;
} 

Number.prototype.clamp = function(min, max) 
{
  return Math.min(Math.max(this, min), max);
}

function getPlaneNormal(array)
{
	var p0 = vec3.fromValues(array[0], array[1], array[2]);
	var p1 = vec3.fromValues(array[3], array[4], array[5]);
	var p2 = vec3.fromValues(array[6], array[7], array[8]);
	
	var p1_p0 = vec3.create();
	var p2_p0 = vec3.create();
	vec3.sub(p1_p0, p1, p0);
	vec3.sub(p2_p0, p2, p1);
	
	var cross = vec3.create();
	vec3.cross(cross, p1_p0, p2_p0);
	
	var dist = Math.sqrt(cross[0]*cross[0] + cross[1]*cross[1] + cross[2]*cross[2]);
		
	var N = vec3.fromValues(cross[0]/dist, cross[1]/dist, cross[2]/dist);
	return N;
}

function fillVerticesWithNormals(array, textureOffset)
{	
	var vertexSize = 3;
	var perVertex = vertexSize + textureOffset;

	var verticesCount = (array.length / perVertex);
	var planesCount = verticesCount / 3;
	
	var vertices = new Float32Array(planesCount * 3 * (perVertex + 3));
	for (var i = 0; i < planesCount; i++)
	{
		var step = i * perVertex * 3;
				
		var planeN = getPlaneNormal([
			array[0 + step], array[1 + step], array[2 + step],
			array[5 + step], array[6 + step], array[7 + step],
			array[10 + step], array[11 + step], array[12 + step]
		]);
		
		var planeArray = new Float32Array([
			array[0 + step], array[1 + step], array[2 + step], planeN[0], planeN[1], planeN[2], array[3 + step], array[4 + step],
			array[5 + step], array[6 + step], array[7 + step], planeN[0], planeN[1], planeN[2], array[8 + step], array[9 + step],
			array[10 + step], array[11 + step], array[12 + step], planeN[0], planeN[1], planeN[2], array[13 + step], array[14 + step]
		]);
		
		for (var j = 0; j < planeArray.length; j++)
		{
			vertices[j + (i * (perVertex + 3) * 3)] = planeArray[j];
		}
	}
	
	return vertices;
}

function init()
{
    var m = mat4.create();
    // inicjalizacja webg2
    try {
        canvas = document.querySelector("#glcanvas");
        gl = canvas.getContext("webgl2");
    }
    catch(e) {
    }
	
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.BACK);

    if (!gl)
    {
        alert("Unable to initialize WebGL.");
        return;
    }

	if (!('pointerLockElement' in document ||
		'mozPointerLockElement' in document ||
		'webkitPointerLockElement' in document))
	{
		console.log("Browser does not support pointer locking!");
	}
	else
	{
		document.addEventListener('pointerlockchange', changeCallback, false);
		document.addEventListener('mozpointerlockchange', changeCallback, false);
		document.addEventListener('webkitpointerlockchange', changeCallback, false);
	}
	
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    gl.clearColor(0.2, 0.2, 0.2, 1.0);

    // kompilacja shader-ow
    var vertex_shader = createShader(gl, gl.VERTEX_SHADER, vs_source);
    var fragment_shader = createShader(gl, gl.FRAGMENT_SHADER, fs_source);
    var program = createProgram(gl, vertex_shader, fragment_shader);

    // pobranie ubi
    var matrices_ubi = gl.getUniformBlockIndex(program, "Matrices");
    var cam_info_ubi = gl.getUniformBlockIndex(program, "CamInfo");
    var material_ubi = gl.getUniformBlockIndex(program, "Material");
    var lights_ubi = gl.getUniformBlockIndex(program, "Lights");
	var ambient_light_ubi = gl.getUniformBlockIndex(program, "AmbientLight");

    // przyporzadkowanie ubi do ubb
    let matrices_ubb = 0;
    gl.uniformBlockBinding(program, matrices_ubi, matrices_ubb);
    let cam_info_ubb = 1;
    gl.uniformBlockBinding(program, cam_info_ubi, cam_info_ubb);
    let material_ubb = 2;
    gl.uniformBlockBinding(program, material_ubi, material_ubb);
    let lights_ubb = 3;
    gl.uniformBlockBinding(program, lights_ubi, lights_ubb);
	let ambient_light_ubb = 4;
    gl.uniformBlockBinding(program, ambient_light_ubi, ambient_light_ubb);
	
	let gpu_positions_attrib_location = 0; // musi być taka sama jak po stronie GPU!!!
    let gpu_normals_attrib_location = 1;
    let gpu_tex_coord_attrib_location = 2;

    // tworzenie sampler-a
    var linear_sampler = gl.createSampler();
    // Ustawienie parametrów sampler-a
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_WRAP_R, gl.REPEAT);
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
	
    // tworzenie teksutry
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // wypelnianie tekstury jednym pikselem
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(255, 255, 255, 255));
    gl.bindTexture(gl.TEXTURE_2D, null);
    // ładowanie obrazka (asynchronicznie)
    var image = new Image();
    image.src = "images/Modern_diffuse.png";
    image.addEventListener('load', function(){
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // ladowanie danych z obrazka do tekstury
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        // tworzenie mipmap
        gl.generateMipmap(gl.TEXTURE_2D);
    });
	
	bg_texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bg_texture);
    // wypelnianie tekstury jednym pikselem
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(255, 255, 255, 255));
    gl.bindTexture(gl.TEXTURE_2D, null);
    // ładowanie obrazka (asynchronicznie)
    var bg_image = new Image();
    bg_image.src = "images/bg.png";
    bg_image.addEventListener('load', function(){
        gl.bindTexture(gl.TEXTURE_2D, bg_texture);
        // ladowanie danych z obrazka do tekstury
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bg_image);
        // tworzenie mipmap
        gl.generateMipmap(gl.TEXTURE_2D);
    });

    // PYRAMID VERTICES
    var vertices = fillVerticesWithNormals([
					//FRONT
					-0.5, 0.0, -0.5,	0.0, 0.0,
					0.0, 1.0, 0.0, 		0.5, 1.0,
                    0.5, 0.0, -0.5,		1.0, 0.0,
					
					//LEFT
					-0.5, 0.0, 0.5,		0.0, 0.0,
					0.0, 1.0, 0.0,		0.5, 1.0,
                    -0.5, 0.0, -0.5,	1.0, 0.0,

					//RIGHT
					0.5, 0.0, 0.5,		0.0, 0.0,
                    0.5, 0.0, -0.5,		1.0, 0.0,
                    0.0, 1.0, 0.0,		0.5, 1.0,

					//BACK
					-0.5, 0.0, 0.5,		0.0, 0.0,
                    0.5, 0.0, 0.5,		1.0, 0.0,
                    0.0, 1.0, 0.0,		0.5, 1.0,
					
					//FLOOR
					-0.5, 0.0, -0.5,	0.0, 0.0,
					0.5, 0.0, -0.5,		1.0, 0.0,
					-0.5, 0.0, 0.5,		0.0, 1.0,
					
					
					-0.5, 0.0, 0.5,		0.0, 1.0,
					0.5, 0.0, -0.5,		1.0, 0.0,
					0.5, 0.0, 0.5,		1.0, 1.0
                    ], 2);
					
    // tworzenie VBO
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // dane o indeksach
    var indices = new Uint16Array([
							0, 1, 2,
							3, 4, 5,
							6, 7, 8,
							9, 10, 11,
							12, 13, 14,
							15, 16, 17
							]);

    // tworzenie bufora indeksow
    var index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // tworzenie VAO
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.enableVertexAttribArray(gpu_positions_attrib_location);
    gl.vertexAttribPointer(gpu_positions_attrib_location, 3, gl.FLOAT, gl.FALSE, 8*4, 0);
    gl.enableVertexAttribArray(gpu_normals_attrib_location);
    gl.vertexAttribPointer(gpu_normals_attrib_location, 3, gl.FLOAT, gl.FALSE, 8*4, 3*4);
    gl.enableVertexAttribArray(gpu_tex_coord_attrib_location);
    gl.vertexAttribPointer(gpu_tex_coord_attrib_location, 2, gl.FLOAT, gl.FALSE, 8*4, 6*4);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	
	//----------------------- OBJECTS IN POINT_LIGHT SOURCE
    var lights_vertices = fillVerticesWithNormals([
					//POINT LIGHT
					-0.2, 0.0, -0.1,	0.0, 0.0,
					0.0, 0.4, 0.0,		0.0, 0.0,
					0.2, 0.0, -0.1,		0.0, 0.0,
					
					0.2, 0.0, -0.1,		0.0, 0.0,
					0.0, 0.4, 0.0,		0.0, 0.0,
					0.0, 0.0, 0.2,		0.0, 0.0,
					
					0.0, 0.0, 0.2,		0.0, 0.0,
					0.0, 0.4, 0.0,		0.0, 0.0,
					-0.2, 0.0, -0.1,	0.0, 0.0,
					
					-0.2, 0.0, -0.1,	0.0, 0.0,
					0.2, 0.0, -0.1,		0.0, 0.0,
					0.0, 0.0, 0.2,		0.0, 0.0
                    ], 2);
					
    // tworzenie VBO
    var lights_vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lights_vbo);
    gl.bufferData(gl.ARRAY_BUFFER, lights_vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // dane o indeksach
    var lights_indices = new Uint16Array([
							0, 1, 2,
							3, 4, 5,
							6, 7, 8,
							9, 10, 11
							]);

    // tworzenie bufora indeksow
    var lights_index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lights_index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // tworzenie VAO
    lights_vao = gl.createVertexArray();
    gl.bindVertexArray(lights_vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, lights_vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lights_index_buffer);
    gl.enableVertexAttribArray(gpu_positions_attrib_location);
    gl.vertexAttribPointer(gpu_positions_attrib_location, 3, gl.FLOAT, gl.FALSE, 8*4, 0);
    gl.enableVertexAttribArray(gpu_normals_attrib_location);
    gl.vertexAttribPointer(gpu_normals_attrib_location, 3, gl.FLOAT, gl.FALSE, 8*4, 3*4);
    gl.enableVertexAttribArray(gpu_tex_coord_attrib_location);
    gl.vertexAttribPointer(gpu_tex_coord_attrib_location, 2, gl.FLOAT, gl.FALSE, 8*4, 6*4);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	
	//------------------------ BACKGROUND ----------------------
	
	var bg_vertices = fillVerticesWithNormals([
					-10.0, 0.0, 10.0,	0.0, 0.0,
					10.0, 0.0, 10.0,	1.0, 0.0,
					-10.0, 0.0, -10.0,	0.0, 1.0,
					-10.0, 0.0, -10.0,	0.0, 1.0,
					10.0, 0.0, 10.0,	1.0, 0.0,
					10.0, 0.0, -10.0,	1.0, 1.0
                    ], 2);
					
    // tworzenie VBO
    var bg_vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bg_vbo);
    gl.bufferData(gl.ARRAY_BUFFER, bg_vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // dane o indeksach
    var bg_indices = new Uint16Array([
							0, 1, 2,
							3, 4, 5
							]);

    // tworzenie bufora indeksow
    var bg_index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bg_index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, bg_indices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // tworzenie VAO
    bg_vao = gl.createVertexArray();
    gl.bindVertexArray(bg_vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, bg_vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bg_index_buffer);
    gl.enableVertexAttribArray(gpu_positions_attrib_location);
    gl.vertexAttribPointer(gpu_positions_attrib_location, 3, gl.FLOAT, gl.FALSE, 8*4, 0);
    gl.enableVertexAttribArray(gpu_normals_attrib_location);
    gl.vertexAttribPointer(gpu_normals_attrib_location, 3, gl.FLOAT, gl.FALSE, 8*4, 3*4);
    gl.enableVertexAttribArray(gpu_tex_coord_attrib_location);
    gl.vertexAttribPointer(gpu_tex_coord_attrib_location, 2, gl.FLOAT, gl.FALSE, 8*4, 6*4);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	
	//------------------------- UBO ------------------------------

    // pozycja kamery
	let cam_pos = new Float32Array([0.0, 2.0, 3.0, 1.]);

    // dane o macierzy
    var mvp_matrix = mat4.create();
    var model_matrix = mat4.create();
	

    // dane dotyczace materialu
    let material_data = new Float32Array([1., 1., 1., 1., 16, 1., 1., 1.]);
		
	let ambient_light_data = new Float32Array([
		1.0, 1.0, 1.0, 1.0
	]);
		
	let lights_data = new Float32Array([
				0.5, 1.0, 0.0, 32.0, 0.0, 1.0, 0.0, 1.0,
				-1.5, 0.7, 2.7, 32.0, 1.0, 0.0, 0.0, 1.0,
				2.0
	]);

    // tworzenie UBO
    matrices_ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, matrices_ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, Float32Concat(mvp_matrix, model_matrix), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
	//------------------------------------
    cam_info_ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, cam_info_ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, cam_pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
	//------------------------------------
    material_ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, material_ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, material_data, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
	//------------------------------------
    lights_ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, lights_ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, lights_data, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
	//------------------------------------
	ambient_light_ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, ambient_light_ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, ambient_light_data, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
	

    // ustawienia danych dla funkcji draw*
    gl.useProgram(program);
	
    gl.bindSampler(0, linear_sampler);
    //gl.activeTexture(gl.TEXTURE0);
	//gl.bindTexture(gl.TEXTURE_2D, texture);
	//gl.bindTexture(gl.TEXTURE_2D, bg_texture);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, matrices_ubb, matrices_ubo);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, cam_info_ubb, cam_info_ubo);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, material_ubb, material_ubo);
	gl.bindBufferBase(gl.UNIFORM_BUFFER, lights_ubb, lights_ubo);
	gl.bindBufferBase(gl.UNIFORM_BUFFER, ambient_light_ubb, ambient_light_ubo);
	
	document.getElementById("glcanvas").addEventListener("click", function(event)
	{
		//canvas.requestPointerLock = canvas.requestPointerLock ||
		//							canvas.mozRequestPointerLock ||
		//							canvas.webkitRequestPointerLock;
		//canvas.requestPointerLock();
	});
		
	function changeCallback(event)
	{
		if (document.pointerLockElement === canvas ||
			document.mozPointerLockElement === canvas ||
			document.webkitPointerLockElement === canvas) 
		{
			document.addEventListener("mousemove", moveCallback, false);
			document.addEventListener("wheel", mouseWheel, false);
		}
		else
		{
			document.removeEventListener("mousemove", moveCallback, false);
			document.removeEventListener("wheel", mouseWheel, false);
		}
	}
		
	function moveCallback(event) 
	{
		var movementX = event.movementX ||
						event.mozMovementX ||
						event.webkitMovementX ||
						0,
			movementY = event.movementY ||
						event.mozMovementY ||
						event.webkitMovementY ||
						0;
		

		var newRotationMatrix = mat4.create();
		mat4.rotateX(newRotationMatrix, newRotationMatrix,degToRad(movementY / 10));
		mat4.rotateY(newRotationMatrix, newRotationMatrix,degToRad(movementX / 10));
		mat4.multiply(RotationMatrix, newRotationMatrix, RotationMatrix);
	}

	function mouseWheel(event)
	{
		var wheelMoveZ = viewerAtZ + (event.deltaY > 0 ? scrollStep : -scrollStep);
		viewerAtZ = wheelMoveZ.clamp(scrollStep, 15);
	}
}

var pyr1_rot = Math.PI/0.1;
var rotationSpeed = 0.02;
var minSpeed = 0.01;
var maxSpeed = 0.2;
var intensivity = 0.4;
var baseRot = Math.PI/2;
var bulletsToDraw = [];

function draw()
{
    // wyczyszczenie ekranu
    gl.clear(gl.COLOR_BUFFER_BIT);
	gl.bindVertexArray(vao);
	//gl.activeTexture(gl.TEXTURE0 + 0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	
	var projection_matrix = mat4.create();
	var view_matrix = mat4.create();
	var mvp_to_copy = mat4.create();
	
	viewerAt = new Float32Array([0, 5, 20]);
	//viewerAt = new Float32Array([EyeX.value/10, EyeY.value/10, EyeZ.value/10]);
	var lookingAt = new Float32Array([LookX.value/10, LookY.value/10, LookZ.value/10]);
	
	//UPDATE POZYCJI ŚWIATŁA
	gl.bindBuffer(gl.UNIFORM_BUFFER, lights_ubo);
	var point_light1_loc = new Float32Array([LptX.value/10, LptY.value/10, LptZ.value/10]);
	var point_light2_loc = new Float32Array([L2ptX.value/10, L2ptY.value/10, L2ptZ.value/10]);
	gl.bufferSubData(gl.UNIFORM_BUFFER, 0, point_light1_loc, 0);
	gl.bufferSubData(gl.UNIFORM_BUFFER, 4*8, point_light2_loc, 0);
	
	//UPDATE POZYCJI KAMERY
	gl.bindBuffer(gl.UNIFORM_BUFFER, cam_info_ubo);
	gl.bufferSubData(gl.UNIFORM_BUFFER, 0, viewerAt, 0);
		
	//VERTEXY
	gl.bindBuffer(gl.UNIFORM_BUFFER, matrices_ubo);
	
	mat4.lookAt(view_matrix, viewerAt, lookingAt, new Float32Array([0, 1, 0]));
	mat4.multiply(view_matrix, view_matrix, RotationMatrix);
	mat4.perspective(projection_matrix, Math.PI/3.0, gl.drawingBufferWidth/gl.drawingBufferHeight, 0.01, 100);
	mat4.multiply(mvp_to_copy, projection_matrix, view_matrix);
	
	var model_matrix = mat4.create();
	var mvp_matrix = mat4.create();
	mat4.copy(mvp_matrix, mvp_to_copy);
	
	
	gl.bindTexture(gl.TEXTURE_2D, texture);



	//generowanie pocisków
	var needGenBullet = ((Math.random() + intensivity) >= 1);
	if (needGenBullet)
	{
		var direction = ([Math.floor(Math.random() * 2 + 1)] == 1) ? Direction.LEFT_TO_RIGHT : Direction.RIGHT_TO_LEFT;
		var x;
		var xSpeed;
		var baseR;
		
		if (direction == Direction.LEFT_TO_RIGHT)
		{
			x = -10.0;
			xSpeed = (Math.random() * maxSpeed + minSpeed);
			baseR = -baseRot;
		}
		else if (direction == Direction.RIGHT_TO_LEFT)
		{
			x = 10.0;
			xSpeed = (Math.random() * -maxSpeed - minSpeed);
			baseR = baseRot;
		}
		
		var y = Math.random() * 20;
		var z = (Math.random() * 20) - 10;
		var rSpeed = (Math.random() * 0.1 + 0.01);
		
		bulletsToDraw.push(new Bullet(vec3.fromValues(x,y,z), direction, xSpeed, rSpeed, baseR, Math.PI/0.1));
	}
	
	
	var bulletsToDelete = [];
	for (var i = 0; i < bulletsToDraw.length; i++)
	{
		
		model_matrix = mat4.create();	
		mvp_matrix = mat4.create();
		mat4.copy(mvp_matrix, mvp_to_copy);
		
		var bullet = bulletsToDraw[i];
		bullet.pos[0] += bullet.xSpeed;
		bullet.r += bullet.rSpeed;
		
		mat4.translate(model_matrix, model_matrix, new Float32Array([bullet.pos[0], bullet.pos[1], bullet.pos[2]]));
		mat4.rotateX(model_matrix, model_matrix, bullet.r);
		mat4.rotateZ(model_matrix, model_matrix, bullet.baseR);
		
		
		mat4.multiply(mvp_matrix, mvp_matrix, model_matrix);
		gl.bufferSubData(gl.UNIFORM_BUFFER, 0, Float32Concat(mvp_matrix, model_matrix), 0);
		gl.drawElements(gl.TRIANGLES, 18, gl.UNSIGNED_SHORT, 0);
		
		if ((bullet.pos[0] < -10.0) || (bullet.pos[0] > 10.0))
			{
				bulletsToDelete.push(i);
			}
	}
	
	
	bulletsToDelete.sort(compareNum);
	for (var i = 0; i < bulletsToDelete.length; i++)
	{
		var index = bulletsToDelete[i];
		delete bulletsToDraw[index];
		bulletsToDraw.splice(index, 1);	
	}
	
	
	
	
	//rysowanie "modeli" świateł punktowych
	gl.bindVertexArray(lights_vao);
	
	//zielony
	model_matrix = mat4.create();	
	mvp_matrix = mat4.create();
	mat4.copy(mvp_matrix, mvp_to_copy);
	
	mat4.translate(model_matrix, model_matrix, point_light1_loc);
	
    mat4.multiply(mvp_matrix, mvp_matrix, model_matrix);
	gl.bufferSubData(gl.UNIFORM_BUFFER, 0, Float32Concat(mvp_matrix, model_matrix), 0);
	gl.drawElements(gl.TRIANGLES, 12, gl.UNSIGNED_SHORT, 0);
	
	//czerwony
	model_matrix = mat4.create();	
	mvp_matrix = mat4.create();
	mat4.copy(mvp_matrix, mvp_to_copy);
	
	mat4.translate(model_matrix, model_matrix, point_light2_loc);
	
    mat4.multiply(mvp_matrix, mvp_matrix, model_matrix);
	gl.bufferSubData(gl.UNIFORM_BUFFER, 0, Float32Concat(mvp_matrix, model_matrix), 0);
	gl.drawElements(gl.TRIANGLES, 12, gl.UNSIGNED_SHORT, 0);
	
	//BACKGROUND
	gl.bindVertexArray(bg_vao);
	gl.bindTexture(gl.TEXTURE_2D, bg_texture);
	
	model_matrix = mat4.create();	
	mvp_matrix = mat4.create();
	mat4.copy(mvp_matrix, mvp_to_copy);
	
    mat4.multiply(mvp_matrix, mvp_matrix, model_matrix);
	gl.bufferSubData(gl.UNIFORM_BUFFER, 0, Float32Concat(mvp_matrix, model_matrix), 0);
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
	
	pyr1_rot += rotationSpeed;
	
    window.requestAnimationFrame(draw);
}

function main()
{
    init();
    draw();
};

function createShader(gl, type, source)
{
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if(success)
    {
        return shader;
    }

    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(gl, vertex_shader, fragment_shader)
{
    var program = gl.createProgram();
    gl.attachShader(program, vertex_shader);
    gl.attachShader(program, fragment_shader);
    gl.linkProgram(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if(success)
    {
        return program;
    }

    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

// vertex shader (GLSL)
var vs_source = "#version 300 es\n" +
    // "location" musi byc takie same jak po stronie CPU!!!
    "layout(location = 0) in vec3 vertex_position;\n" +
    "layout(location = 1) in vec3 vertex_normal;\n" +
    "layout(location = 2) in vec2 vertex_tex_coord;\n" +
    "out vec3 position_ws;\n" +
    "out vec3 normal_ws;\n" +
    "out vec2 tex_coord;\n" +
	
    "layout(std140) uniform Matrices\n" +
    "{\n" +
        "mat4 mvp_matrix;\n" +
        "mat4 model_matrix;\n" +
    "} matrices;\n" +
	
    "void main()\n" +
    "{\n" +
        "gl_Position = matrices.mvp_matrix*vec4(vertex_position, 1.f);\n" +
        "vec4 tmp_position_ws = matrices.model_matrix*vec4(vertex_position, 1.f);\n" +
        "position_ws = tmp_position_ws.xyz/tmp_position_ws.w;\n" +
        "normal_ws = mat3x3(matrices.model_matrix)*vertex_normal;\n" +
        "tex_coord = vertex_tex_coord;\n" +
    "}\n";


//L=pozycja pointlaita odjac pozycja fragmentu, dla ktorego liczymy oswietlenie, znormalizowane wektory
//wektor normalny prostopadly do powierzchni, vertex_normal
//wektor v wskzaujacy w strone kamery, polozenie kamery uniform odjac 
//wektor R wektor L odbity wzgledem normalnej reflect funkcja
//oświetlenie dyfuzyjne, nie zalezy od polozenia obserwatora
//oswietlenie specular, zalezy od polozenia obserwatora, odbicia, spec power - wielkosc odbicia, spec intensity - intensywnosc
//jeden przez kwadrat odleglosci od swiatla
// aten 1 - odlelgosc od swiatla/ pointlight radius


// fragment shader (GLSL)
var fs_source = "#version 300 es\n" +
    // fs nie ma domyślnej precyzji dla liczb zmiennoprzecinkowych więc musimy wybrać ją sami
    "precision mediump float;\n" +

    "in vec3 position_ws;\n" +
    "in vec3 normal_ws;\n" +
    "in vec2 tex_coord;\n" +
    "out vec4 vFragColor;\n" +

	"struct Light\n" +
	"{\n" +
		"vec3 position_ws;\n" +
		"float r;\n" +
		"vec3 color;\n" +
	"};\n" +
	
    "uniform sampler2D color_tex;\n" +

    "layout(std140) uniform CamInfo\n" +
    "{\n" +
       "vec3 cam_pos_ws;\n" +
    "} additional_data;\n" +

    "layout(std140) uniform Material\n" +
    "{\n" +
       "vec3 color;\n" +
       "float specular_intensity;\n" +
       "float specular_power;\n" +
    "} material;\n" +
		
    "layout(std140) uniform Lights\n" +
    "{\n" +
       "Light light[2];\n" +
	   "float size;\n" +
    "}lights;\n" +
	
	"layout(std140) uniform AmbientLight\n" +
    "{\n" +
       "vec3 color;\n" +
    "} ambient_light;\n" +
	
    "void main()\n" +
    "{\n" +
		"if (tex_coord == vec2(0.0, 0.0))\n" +
		"{\n" +
			"vFragColor = vec4(1.0, 1.0, 0.0, 1.0);" +
			"return;\n" +
		"}\n" +
			
		"vec3 diffuse = vec3(0.f, 0.f, 0.f);\n" +
		"vec3 specular = vec3(0.f, 0.f, 0.f);\n" +
		
		"for (int i = 0; i < int(lights.size); i++)\n" +
		"{\n" +
		
			"vec3 surf_to_light = lights.light[i].position_ws - position_ws;\n" +
			"float surf_to_light_distance = length(surf_to_light);\n" +
			"if (surf_to_light_distance < lights.light[i].r)\n" +
			"{\n" +
				"vec3 L = normalize(surf_to_light);\n" +
				"float intensity = 1.f - surf_to_light_distance/lights.light[i].r;\n" +
				"intensity *= intensity;\n" +

				"vec3 N = normalize(normal_ws);\n" +
				"float N_dot_L = clamp(dot(N,L), 0.f, 1.f);\n" +
				"diffuse += N_dot_L * intensity * lights.light[i].color * material.color;\n" +
				"vec3 V = normalize(additional_data.cam_pos_ws - lights.light[i].position_ws);\n" +
				"vec3 R = normalize(reflect(-L, N));\n" +
				"float spec_angle = max(dot(R, V), 0.f);\n" +
				"specular += pow(spec_angle, material.specular_power) * lights.light[i].color * intensity;\n" +
		
			"}\n" +
		//"vec3 R = (L+V)/ normalize(L+V);\n" +
		//"vFragColor = vec4((N + 1.)/2., 1.);\n" +
		"}\n" +
	  
		"vFragColor = vec4(clamp((clamp(diffuse + ambient_light.color, 0.f, 1.f) * texture(color_tex, tex_coord).rgb + specular), 0.f, 1.f), 1.f);\n" +
    "}\n";

main();

/*
 * 
 *  V = pozycja kamery - pozycja na powierzchni + normalizacja
 *  R = gl.reflect + normalizacja
 * 
 * 
 * vec3 diffuse = vec3(0.f, 0.f, 0.f,);
 * vec3 specular = vec3(0.f, 0.f, 0.f);
 * 
 * vec3 surf_to_light = point_light.position_ws - position_ws;
 * float surt_to_light_distance = length(surf_to_light);
 * if (surf_to_light_distance < point_light.r)
 * {
 *     vec3 L = normalize(surf_to_light);
 *     float intensity = 1.f - surt_to_light_distance/point_light.r;
 *     intensity *= intensity;
 *     
 *     vec3 N = normalize(normal_ws);
 *    float N_dot_L = clap(dot(N,L), 0.f, 1.f);
 *     diffuse = N_dot_L * intensity * point_light.color * material.color;
 * }
 * vFragColor = vec4(clamp((diffuse + specular) * texture(color_tex, tex_coord).rgb, 0.f, 1.f), 1);
 * 
 * 
 *     /*
    "vec3 L = normalize(point_light.position_ws - position_ws);\n" +
    "vec3 N = normalize(normal_ws);\n" +
      "float light = dot(N, L);\n" +
    "float odleglosc = distance(position_ws, point_light. position_ws);\n" +
    "float atten = 1.0 - odleglosc/ ( point_light.r);\n" +
    "vec3 result = texture(color_tex, tex_coord).rgb;\n" +
    "vFragColor = vec4(result, 1.0);\n" +
	"vFragColor.rgb *= light * point_light.color * atten;\n" +
    
 * 
 */
