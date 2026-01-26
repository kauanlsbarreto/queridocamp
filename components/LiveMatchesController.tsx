"use client"

import { useState, useEffect } from "react";
import LiveMatchesModal from "./LiveMatchesModal";

const LiveMatchesController = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const visitCountStr = localStorage.getItem('queridoCampVisitCount');
        let count = visitCountStr ? parseInt(visitCountStr, 10) : 0;
        count++;
        localStorage.setItem('queridoCampVisitCount', count.toString());

        if (count % 2 !== 0) {
            setIsModalOpen(true);
        }
    }, []);

    return <LiveMatchesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />;
};

export default LiveMatchesController;