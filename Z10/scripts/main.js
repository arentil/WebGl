"use strict";

var gl;
				
var point_light_ubo;
var matrices_ubo;

function Float32Concat(first, second)
{
    let first_length = first.length,
        result = new Float32Array(first_length + second.length);
    result.set(first);
    result.set(second, first_length);
    return result;
}

function init()
{
    var m = mat4.create();
    // inicjalizacja webg2
    try {
        let canvas = document.querySelector("#glcanvas");
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
    var point_light_ubi = gl.getUniformBlockIndex(program, "PointLight");

    // przyporzadkowanie ubi do ubb
    let matrices_ubb = 0;
    gl.uniformBlockBinding(program, matrices_ubi, matrices_ubb);
    let cam_info_ubb = 1;
    gl.uniformBlockBinding(program, cam_info_ubi, cam_info_ubb);
    let material_ubb = 2;
    gl.uniformBlockBinding(program, material_ubi, material_ubb);
    let point_light_ubb = 3;
    gl.uniformBlockBinding(program, point_light_ubi, point_light_ubb);

    // tworzenie sampler-a
    var linear_sampler = gl.createSampler();
    // Ustawienie parametrów sampler-a
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_WRAP_R, gl.REPEAT);
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    // tworzenie teksutry
    var texture = gl.createTexture();
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
    
    // dane o wierzcholkach
	
        var vertices = new Float32Array([
					//FRONT
					-0.5, 0.0, -0.5,   0.0, 0.447214, -0.894427,   0.0, 0.0,
					0.0, 1.0, 0.0,     0.0, 0.447214, -0.894427,   0.5, 1.0,
                    0.5, 0.0, -0.5,    0.0, 0.447214, -0.894427,   1.0, 0.0,
					
					//LEFT
					-0.5, 0.0, 0.5,   -0.894427, 0.447214, 0.0,   0.0, 0.0,
					0.0, 1.0, 0.0,    -0.894427, 0.447214, 0.0,   0.5, 1.0,
                    -0.5, 0.0, -0.5,  -0.894427, 0.447214, 0.0,   1.0, 0.0,

					//RIGHT
					0.5, 0.0, 0.5,   0.894427, 0.447214, 0.0,   0.0, 0.0,
                    0.5, 0.0, -0.5,  0.894427, 0.447214, 0.0,   1.0, 0.0,
                    0.0, 1.0, 0.0,   0.894427, 0.447214, 0.0,   0.5, 1.0,

					//BACK
					-0.5, 0.0, 0.5,   0.0, 0.447214, 0.894427,   0.0, 0.0,
                    0.5, 0.0, 0.5,    0.0, 0.447214, 0.894427,   1.0, 0.0,
                    0.0, 1.0, 0.0,    0.0, 0.447214, 0.894427,   0.5, 1.0,

					//POINT LIGHT
					-0.2, 0.0, -0.1,  	0.0, 0.0, 1.0,  0.5, 0.0,
					0.0, 0.4, 0.0,  	0.0, 0.0, 1.0,  0.5, 0.0,
					0.2, 0.0, -0.1,    	0.0, 0.0, 1.0,  0.5, 0.0,
					
					0.2, 0.0, -0.1,    	0.0, 0.0, 1.0,  0.5, 0.0,
					0.0, 0.4, 0.0,  	0.0, 0.0, 1.0,  0.5, 0.0,
					0.0, 0.0, 0.2, 		0.0, 0.0, 1.0,  0.5, 0.0,
					
					0.0, 0.0, 0.2, 		0.0, 0.0, 1.0,  0.5, 0.0,
					0.0, 0.4, 0.0,  	0.0, 0.0, 1.0,  0.5, 0.0,
					-0.2, 0.0, -0.1,  	0.0, 0.0, 1.0,  0.5, 0.0,
					
					-0.2, 0.0, -0.1,  	0.0, 0.0, 1.0,  0.5, 0.0,
					0.2, 0.0, -0.1,    	0.0, 0.0, 1.0,  0.5, 0.0,
					0.0, 0.0, 0.2, 		0.0, 0.0, 1.0,  0.5, 0.0
                    ]);


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
							15, 16, 17,
							18, 19, 20,
							21, 22, 23

							]);

    // tworzenie bufora indeksow
    var index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    let gpu_positions_attrib_location = 0; // musi być taka sama jak po stronie GPU!!!
    let gpu_normals_attrib_location = 1;
    let gpu_tex_coord_attrib_location = 2;

    // tworzenie VAO
    var vao = gl.createVertexArray();
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

    // pozycja kamery
    let cam_pos = new Float32Array([1., 0.2, 4., 1.]);

    // dane o macierzy
    var mvp_matrix = mat4.create();
    var model_matrix = mat4.create();
	
    //var view_matrix = mat4.create();
    //mat4.lookAt(view_matrix, cam_pos, new Float32Array([0., 0., 0.]), new Float32Array([0., 1., 0.]));
    //var projection_matrix = mat4.create();
   // mat4.perspective(projection_matrix, Math.PI/4., gl.drawingBufferWidth/gl.drawingBufferHeight, 0.01, 10);
    //mat4.multiply(mvp_matrix, projection_matrix, view_matrix);
    //mat4.multiply(mvp_matrix, mvp_matrix, model_matrix);
	

    // dane dotyczace materialu
    let material_data = new Float32Array([1., 1., 1., 1., 256,    1.,1.,1.]);

    // dane dotyczace swiatla punktowego
	//0.0, 2.0, 2.0
	//0.0, 1.0, 0.8
    let point_light_data = new Float32Array([1.5, 0.5, 0.0, 32.0, 1.0, 1.0, 1.0, 1.0]);
	
					

    // tworzenie UBO
    matrices_ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, matrices_ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, Float32Concat(mvp_matrix, model_matrix), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    var cam_info_ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, cam_info_ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, cam_pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    var material_ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, material_ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, material_data, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    point_light_ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, point_light_ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, point_light_data, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);

    // ustawienia danych dla funkcji draw*
    gl.useProgram(program);
    gl.bindSampler(0, linear_sampler);
    gl.activeTexture(gl.TEXTURE0 +  0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.bindVertexArray(vao);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, matrices_ubb, matrices_ubo);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, cam_info_ubb, cam_info_ubo);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, material_ubb, material_ubo);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, point_light_ubb, point_light_ubo);
	gl.bindBuffer(gl.UNIFORM_BUFFER, matrices_ubo);
}

var pyr1_rot = Math.PI/0.1;
var rotationSpeed = 0.04;

function draw()
{
    // wyczyszczenie ekranu
    gl.clear(gl.COLOR_BUFFER_BIT);
	
	var point_light_loc = new Float32Array([LptX.value/10, LptY.value/10, LptZ.value/10]);
	gl.bindBuffer(gl.UNIFORM_BUFFER, point_light_ubo);
	gl.bufferSubData(gl.UNIFORM_BUFFER, 0, point_light_loc, 0);
	gl.bindBuffer(gl.UNIFORM_BUFFER, matrices_ubo);
	
	
	
		
	var projection_matrix = mat4.create();
	var view_matrix = mat4.create();
	var mvp_to_copy = mat4.create();
	
	var viewerAt = new Float32Array([EyeX.value/10, EyeY.value/10, EyeZ.value/10]);
	var lookingAt = new Float32Array([LookX.value/10, LookY.value/10, LookZ.value/10]);
	var pointingAt = new Float32Array([PtX.value/10, PtY.value/10, PtZ.value/10]);
	
	mat4.lookAt(view_matrix, viewerAt, lookingAt, pointingAt);
	mat4.perspective(projection_matrix, Math.PI/3.0, gl.drawingBufferWidth/gl.drawingBufferHeight, 0.01, 100);
	mat4.multiply(mvp_to_copy, projection_matrix, view_matrix);

	//FIRST PIRAMYD
	var model_matrix = mat4.create();
	var mvp_matrix = mat4.create();
	mat4.copy(mvp_matrix, mvp_to_copy);
	
	mat4.rotateY(model_matrix, model_matrix, pyr1_rot);
	//mat4.multiply(mvp_matrix, projection_matrix, view_matrix);
    //mat4.multiply(mvp_matrix, mvp_matrix, model_matrix);
	
	
	mat4.multiply(mvp_matrix, mvp_matrix, model_matrix);
	gl.bufferSubData(gl.UNIFORM_BUFFER, 0, Float32Concat(mvp_matrix, model_matrix), 0);
	gl.drawElements(gl.TRIANGLES, 12, gl.UNSIGNED_SHORT, 0);
	
	
	// SECOND PIRAMYD
	model_matrix = mat4.create();	
	mvp_matrix = mat4.create();
	mat4.copy(mvp_matrix, mvp_to_copy);
	
	mat4.translate(model_matrix, model_matrix, point_light_loc);
	//mat4.rotateY(model_matrix, model_matrix, pyr1_rot);
	
    mat4.multiply(mvp_matrix, mvp_matrix, model_matrix);
	gl.bufferSubData(gl.UNIFORM_BUFFER, 0, Float32Concat(mvp_matrix, model_matrix), 0);
	gl.drawElements(gl.TRIANGLES, 12, gl.UNSIGNED_SHORT, 24);
	
	
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

    "layout(std140) uniform PointLight\n" +
    "{\n" +
       "vec3 position_ws;\n" +
       "float r;\n" +
       "vec3 color;\n" +
    "} point_light;\n" +

    "void main()\n" +
    "{\n" +
    
      "vec3 diffuse = vec3(0.f, 0.f, 0.f);\n" +
      "vec3 specular = vec3(0.f, 0.f, 0.f);\n" +
      
      "vec3 surf_to_light = point_light.position_ws - position_ws;\n" +
      "float surf_to_light_distance = length(surf_to_light);\n" +
      "if (surf_to_light_distance < point_light.r)\n" +
      "{\n" +
      "vec3 L = normalize(surf_to_light);\n" +
      "float intensity = 1.f - surf_to_light_distance/point_light.r;\n" +
      "intensity *= intensity;\n" +
          
      "vec3 N = normalize(normal_ws);\n" +
      "float N_dot_L = clamp(dot(N,L), 0.f, 1.f);\n" +
      "diffuse = N_dot_L * intensity * point_light.color * material.color;\n" +
      "vec3 V = normalize(additional_data.cam_pos_ws - point_light.position_ws);\n" +
      "vec3 R = normalize(reflect(-L, N));\n" +
      "float spec_angle = max(dot(R, V), 0.f);\n" +
      "specular = pow(spec_angle, material.specular_power) * point_light.color * intensity;\n" +
      //"vec3 R = (L+V)/ normalize(L+V);\n" +
	  
	  
	  //"vFragColor = vec4((N + 1.)/2., 1.);\n" +
      "}\n" +
      "vFragColor = vec4(clamp((diffuse * texture(color_tex, tex_coord).rgb + specular), 0.f, 1.f), 1.f);\n" +
      
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
