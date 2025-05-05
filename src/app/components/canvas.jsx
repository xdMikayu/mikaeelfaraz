"use client"

import { Center, OrthographicCamera, Environment} from "@react-three/drei"
import { Canvas } from "@react-three/fiber"

import { Suspense } from "react"

import Model from "./model"

export default function Scene(){
    
    return(
    <Canvas>
        <Environment preset="city" intensity={1} />
        <directionalLight position={[3,3,5]} intensity={10}/>
        <Suspense fallback={null}/>
        <OrthographicCamera makeDefault position={[0, 0, 500]} fov={25} near={0.1} far={1000} />
            <Center>
                <Model />
            </Center>
    </Canvas>
    )
}