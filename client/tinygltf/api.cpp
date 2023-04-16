#include <emscripten.h>

extern "C"
{
	EMSCRIPTEN_KEEPALIVE void* alloc(unsigned long long size);
	EMSCRIPTEN_KEEPALIVE void dealloc(void* ptr);
	EMSCRIPTEN_KEEPALIVE void zero(void* ptr, unsigned long long size);

	EMSCRIPTEN_KEEPALIVE void* load_glb(unsigned char* data, unsigned long long size);
	EMSCRIPTEN_KEEPALIVE void delete_model(void* ptr);

	EMSCRIPTEN_KEEPALIVE int model_number_of_meshes(void* ptr);
	EMSCRIPTEN_KEEPALIVE void *model_get_mesh(void* ptr, int mesh_id);

	EMSCRIPTEN_KEEPALIVE int mesh_number_of_primitives(void* ptr);	
	EMSCRIPTEN_KEEPALIVE void* mesh_get_primitive(void* ptr, int prim_idx);

	EMSCRIPTEN_KEEPALIVE int prim_material_id(void* ptr);
	EMSCRIPTEN_KEEPALIVE int prim_number_of_vertices(void* ptr_model, void* ptr_prim);
	EMSCRIPTEN_KEEPALIVE float* prim_get_positions(void* ptr_model, void* ptr_prim);
	EMSCRIPTEN_KEEPALIVE const char* prim_get_index_type(void* ptr_model, void* ptr_prim);
	EMSCRIPTEN_KEEPALIVE int prim_get_num_faces(void* ptr_model, void* ptr_prim);
	EMSCRIPTEN_KEEPALIVE void* prim_get_indices(void* ptr_model, void* ptr_prim);
	EMSCRIPTEN_KEEPALIVE float* prim_get_normals(void* ptr_model, void* ptr_prim);
}

#include <cstdio>
#include <memory.h>


#define TINYGLTF_IMPLEMENTATION
#define TINYGLTF_NO_STB_IMAGE
#define TINYGLTF_NO_STB_IMAGE_WRITE
//#define STB_IMAGE_IMPLEMENTATION
//#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "tiny_gltf.h"


void* alloc(unsigned long long size)
{
	return malloc(size);
}

void dealloc(void* ptr)
{
	free(ptr);
}

void zero(void* ptr, unsigned long long size)
{
	memset(ptr, 0, size);
}

void* load_glb(unsigned char* data, unsigned long long size)
{
	std::string err;
	std::string warn;
	tinygltf::TinyGLTF loader;	
	tinygltf::Model* model = new tinygltf::Model;
	loader.LoadBinaryFromMemory(model, &err, &warn, data, size);
	return model;
}

void delete_model(void* ptr)
{
	tinygltf::Model* model = (tinygltf::Model*)ptr;
	delete model;
}

int model_number_of_meshes(void* ptr)
{
	tinygltf::Model* model = (tinygltf::Model*)ptr;
	return (int)model->meshes.size();
}

void *model_get_mesh(void* ptr, int mesh_id)
{
	tinygltf::Model* model = (tinygltf::Model*)ptr;
	return &model->meshes[mesh_id];
}

int mesh_number_of_primitives(void* ptr)
{	
	tinygltf::Mesh* mesh = (tinygltf::Mesh*)ptr;
	return (int)mesh->primitives.size();
}

void* mesh_get_primitive(void* ptr, int prim_idx)
{
	tinygltf::Mesh* mesh = (tinygltf::Mesh*)ptr;
	return &mesh->primitives[prim_idx];
}

int prim_material_id(void* ptr)
{
	tinygltf::Primitive* prim = (tinygltf::Primitive*)ptr;
	return prim->material;
}

int prim_number_of_vertices(void* ptr_model, void* ptr_prim)
{
	tinygltf::Model* model = (tinygltf::Model*)ptr_model;
	tinygltf::Primitive* prim = (tinygltf::Primitive*)ptr_prim;
	int id_pos_in = prim->attributes["POSITION"];
	tinygltf::Accessor& acc_pos_in = model->accessors[id_pos_in];
	return (int)acc_pos_in.count;
}

float* prim_get_positions(void* ptr_model, void* ptr_prim)
{
	tinygltf::Model* model = (tinygltf::Model*)ptr_model;
	tinygltf::Primitive* prim = (tinygltf::Primitive*)ptr_prim;
	int id_pos_in = prim->attributes["POSITION"];
	tinygltf::Accessor& acc_pos_in = model->accessors[id_pos_in];
	tinygltf::BufferView& view_pos_in = model->bufferViews[acc_pos_in.bufferView];
	return (float*)(model->buffers[view_pos_in.buffer].data.data() + view_pos_in.byteOffset + acc_pos_in.byteOffset);
}

const char* prim_get_index_type(void* ptr_model, void* ptr_prim)
{
	static char types[4][10] = {
		"none",
		"ubyte",
		"ushort",
		"uint"
	};

	tinygltf::Model* model = (tinygltf::Model*)ptr_model;
	tinygltf::Primitive* prim = (tinygltf::Primitive*)ptr_prim;

	int id_indices_in = prim->indices;
	if (id_indices_in >= 0)
	{
		tinygltf::Accessor& acc_indices_in = model->accessors[id_indices_in];
		if (acc_indices_in.componentType == TINYGLTF_COMPONENT_TYPE_UNSIGNED_BYTE)
		{
			return types[1];
		}
		else if (acc_indices_in.componentType == TINYGLTF_COMPONENT_TYPE_UNSIGNED_SHORT)
		{
			return types[2];
		}
		else if (acc_indices_in.componentType == TINYGLTF_COMPONENT_TYPE_UNSIGNED_INT)
		{
			return types[3];
		}
	}
	else
	{
		return types[0];
	}
}

int prim_get_num_faces(void* ptr_model, void* ptr_prim)
{
	tinygltf::Model* model = (tinygltf::Model*)ptr_model;
	tinygltf::Primitive* prim = (tinygltf::Primitive*)ptr_prim;

	int id_indices_in = prim->indices;
	if (id_indices_in >= 0)
	{
		tinygltf::Accessor& acc_indices_in = model->accessors[id_indices_in];
		return (int)(acc_indices_in.count / 3);
	}
	else
	{
		return prim_number_of_vertices(ptr_model, ptr_prim) / 3;
	}
}


void* prim_get_indices(void* ptr_model, void* ptr_prim)
{
	tinygltf::Model* model = (tinygltf::Model*)ptr_model;
	tinygltf::Primitive* prim = (tinygltf::Primitive*)ptr_prim;
	int id_indices_in = prim->indices;
	if (id_indices_in >= 0)
	{
		tinygltf::Accessor& acc_indices_in = model->accessors[id_indices_in];
		tinygltf::BufferView& view_indices_in = model->bufferViews[acc_indices_in.bufferView];
		return model->buffers[view_indices_in.buffer].data.data() + view_indices_in.byteOffset + acc_indices_in.byteOffset;
	}
	else
	{
		return nullptr;
	}
}

float* prim_get_normals(void* ptr_model, void* ptr_prim)
{
	tinygltf::Model* model = (tinygltf::Model*)ptr_model;
	tinygltf::Primitive* prim = (tinygltf::Primitive*)ptr_prim;
	if (prim->attributes.find("NORMAL") != prim->attributes.end())
	{
		int id_norm_in = prim->attributes["NORMAL"];
		tinygltf::Accessor& acc_norm_in = model->accessors[id_norm_in];
		tinygltf::BufferView& view_norm_in = model->bufferViews[acc_norm_in.bufferView];
		return (float*)(model->buffers[view_norm_in.buffer].data.data() + view_norm_in.byteOffset + acc_norm_in.byteOffset);
	}
}