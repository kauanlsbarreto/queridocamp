import { NextResponse } from 'next/server';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPools } from '@/lib/db';

export async function GET() {
    let env = {};
    try {
        const ctx = await getCloudflareContext();
        env = ctx.env;
    } catch (e) { }
    const { mainPool: pool } = getPools(env);

    try {
        const [rows] = await pool.query('SELECT * FROM codigos_sistema ORDER BY id DESC');
        return NextResponse.json(rows);
    } catch (error) {
        console.error("Database error:", error);
        return NextResponse.json({ message: 'Erro ao buscar códigos' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    let env = {};
    try {
        const ctx = await getCloudflareContext();
        env = ctx.env;
    } catch (e) { }
    const { mainPool: pool } = getPools(env);

    try {
        const body = await req.json();
        const { tipo, nome, codigo } = body;

        if (!tipo || !nome || !codigo) {
            return NextResponse.json({ message: 'Campos obrigatórios faltando' }, { status: 400 });
        }

        const [existing]: any = await pool.query('SELECT id FROM codigos_sistema WHERE codigo = ?', [codigo]);
        if (existing.length > 0) {
             return NextResponse.json({ message: 'Este código já existe.' }, { status: 400 });
        }

        await pool.query(
            'INSERT INTO codigos_sistema (tipo, nome, codigo, usado) VALUES (?, ?, ?, 0)',
            [tipo, nome, codigo]
        );

        return NextResponse.json({ success: true, codigo });
    } catch (error) {
        console.error("Database error:", error);
        return NextResponse.json({ message: 'Erro ao criar código' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    let env = {};
    try {
        const ctx = await getCloudflareContext();
        env = ctx.env;
    } catch (e) { }
    const { mainPool: pool } = getPools(env);

    try {
        const body = await req.json();
        const { id, nome, codigo } = body;

        if (!id || !nome || !codigo) {
            return NextResponse.json({ message: 'Campos obrigatórios faltando' }, { status: 400 });
        }

        await pool.query(
            'UPDATE codigos_sistema SET nome = ?, codigo = ? WHERE id = ?',
            [nome, codigo, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Database error:", error);
        return NextResponse.json({ message: 'Erro ao atualizar código' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    let env = {};
    try {
        const ctx = await getCloudflareContext();
        env = ctx.env;
    } catch (e) { }
    const { mainPool: pool } = getPools(env);

    try {
        const body = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ message: 'ID é obrigatório' }, { status: 400 });
        }

        await pool.query('DELETE FROM codigos_sistema WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Database error:", error);
        return NextResponse.json({ message: 'Erro ao deletar código' }, { status: 500 });
    }
}
