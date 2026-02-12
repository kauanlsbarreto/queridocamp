import { NextResponse } from 'next/server';
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const guid = searchParams.get('guid');
  const region = searchParams.get('region');

  if (!guid || !region) {
    return NextResponse.json({ error: 'GUID and region required' }, { status: 400 });
  }

  try {
    const apiKey = '7b080715-fe0b-461d-a1f1-62cfd0c47e63'; 
    
    const res = await fetch(`https://open.faceit.com/data/v4/rankings/games/cs2/regions/${region}/players/${guid}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!res.ok) throw new Error('Faceit API error');
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}